import os
import sys
import glob
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import nibabel as nib
import cv2
from dotenv import load_dotenv
import torchvision.models as models
from sklearn.metrics import confusion_matrix, roc_auc_score, accuracy_score
from sklearn.model_selection import train_test_split, KFold

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', '.env')
load_dotenv(env_path)

LOCAL_SCAN_PATH = os.getenv("LOCAL_SCAN_PATH")

class BraTSDataset(Dataset):
    def __init__(self, data_list):
        self.data_list = data_list
        
    def __len__(self):
        return len(self.data_list)
        
    def preprocess_channel(self, path):
        # Load NIfTI channel
        img = nib.load(path).get_fdata()
        # Take center slice relative to z-axis (assuming shape x, y, z)
        slice_2d = img[:, :, img.shape[2] // 2]
        # Resize to 224x224
        slice_resized = cv2.resize(slice_2d, (224, 224))
        # Normalize to 0-1
        if slice_resized.max() > 0:
            slice_resized = slice_resized / slice_resized.max()
        return slice_resized

    def __getitem__(self, idx):
        patient_folder, label = self.data_list[idx]
        
        t1c_path = glob.glob(os.path.join(patient_folder, "*-t1c.nii.gz"))[0]
        t1n_path = glob.glob(os.path.join(patient_folder, "*-t1n.nii.gz"))[0]
        t2f_path = glob.glob(os.path.join(patient_folder, "*-t2f.nii.gz"))[0]
        t2w_path = glob.glob(os.path.join(patient_folder, "*-t2w.nii.gz"))[0]
        
        t1c = self.preprocess_channel(t1c_path)
        t1n = self.preprocess_channel(t1n_path)
        t2f = self.preprocess_channel(t2f_path)
        t2w = self.preprocess_channel(t2w_path)
        
        # Stack into 4-channel tensor (T1n, T1c, T2w, FLAIR)
        stacked = np.stack([t1n, t1c, t2w, t2f], axis=0).astype(np.float32)
        tensor = torch.from_numpy(stacked)
        
        return tensor, torch.tensor([float(label)], dtype=torch.float32)

def prepare_data():
    if not LOCAL_SCAN_PATH or not os.path.exists(LOCAL_SCAN_PATH):
        print(f"Error: Invalid LOCAL_SCAN_PATH defined in backend/.env: {LOCAL_SCAN_PATH}")
        sys.exit(1)
        
    patient_dirs = []
    # Recursively find valid patient directories
    for root, dirs, files in os.walk(LOCAL_SCAN_PATH):
        required_suffixes = ["-t1c.nii.gz", "-t1n.nii.gz", "-t2f.nii.gz", "-t2w.nii.gz", "-seg.nii.gz"]
        has_all = True
        for req in required_suffixes:
            if not any(req in f for f in files):
                has_all = False
                break
        if has_all:
            patient_dirs.append(root)
            
    print(f"Found {len(patient_dirs)} complete patient records.")
    
    data_list = []
    for p_dir in patient_dirs:
        seg_file = glob.glob(os.path.join(p_dir, "*-seg.nii.gz"))[0]
        seg_img = nib.load(seg_file).get_fdata()
        # Any non-zero voxels indicates malignant tumour
        label = 1 if np.any(seg_img > 0) else 0
        data_list.append((p_dir, label))
        
    return data_list

def create_model():
    # Load EfficientNet-B4
    model = models.efficientnet_b4(weights=models.EfficientNet_B4_Weights.DEFAULT)
    
    # Modify first Conv2d layer to accept 4 channels instead of 3
    original_conv = model.features[0][0]
    new_conv = nn.Conv2d(
        in_channels=4, 
        out_channels=original_conv.out_channels, 
        kernel_size=original_conv.kernel_size,
        stride=original_conv.stride, 
        padding=original_conv.padding, 
        bias=original_conv.bias is not None
    )
    
    # Copy pre-trained weights for the first 3 channels, average for the 4th channel
    with torch.no_grad():
        new_conv.weight[:, :3, :, :] = original_conv.weight.clone()
        new_conv.weight[:, 3, :, :] = original_conv.weight[:, :3, :, :].mean(dim=1).clone()
    
    model.features[0][0] = new_conv
    
    # Adapt final classifier for binary classification
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, 1)
    
    # Bundle Sigmoid activation for BCE Loss bounds
    return nn.Sequential(model, nn.Sigmoid())

def train():
    print("Initiating dataset scanning...")
    data_list = prepare_data()
    if len(data_list) < 5:
        print("Not enough data to run 5-Fold Cross Validation.")
        return
        
    # Isolate 15% out for final testing
    train_val_data, test_data = train_test_split(data_list, test_size=0.15, random_state=42)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Hardware Acceleration Engine: {device}")
    
    test_ds = BraTSDataset(test_data)
    test_loader = DataLoader(test_ds, batch_size=8, shuffle=False)
    
    # 5-fold cross validation configuration
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    best_overall_val_loss = float('inf')
    
    model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'models')
    os.makedirs(model_dir, exist_ok=True)
    best_model_path = os.path.join(model_dir, 'efficientnet_brats.pth')

    print("\n--- Booting 5-Fold Cross Validation Pipeline ---")
    
    for fold, (train_idx, val_idx) in enumerate(kf.split(train_val_data)):
        print(f"\n=== Commencing Fold {fold+1}/5 ===")
        
        train_subset = [train_val_data[i] for i in train_idx]
        val_subset = [train_val_data[i] for i in val_idx]
        
        train_loader = DataLoader(BraTSDataset(train_subset), batch_size=8, shuffle=True)
        val_loader = DataLoader(BraTSDataset(val_subset), batch_size=8, shuffle=False)
        
        model = create_model().to(device)
        criterion = nn.BCELoss()
        optimizer = optim.Adam(model.parameters(), lr=0.0001)
        
        for epoch in range(20):
            model.train()
            train_loss = 0.0
            correct = 0
            total = 0
            
            for X, y in train_loader:
                X, y = X.to(device), y.to(device)
                optimizer.zero_grad()
                outputs = model(X)
                loss = criterion(outputs, y)
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item() * X.size(0)
                preds = (outputs > 0.5).float()
                correct += (preds == y).sum().item()
                total += y.size(0)
                
            train_loss /= total
            train_acc = correct / total
            
            model.eval()
            val_loss = 0.0
            val_correct = 0
            val_total = 0
            
            with torch.no_grad():
                for X, y in val_loader:
                    X, y = X.to(device), y.to(device)
                    outputs = model(X)
                    loss = criterion(outputs, y)
                    val_loss += loss.item() * X.size(0)
                    preds = (outputs > 0.5).float()
                    val_correct += (preds == y).sum().item()
                    val_total += y.size(0)
                    
            val_loss /= val_total
            val_acc = val_correct / val_total
            
            print(f"Epoch {epoch+1}/20 - Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}")
            
            if val_loss < best_overall_val_loss:
                best_overall_val_loss = val_loss
                torch.save(model.state_dict(), best_model_path)
                print(f"   [!] Validation improved -> Saved architecture weights to {best_model_path}")
                
    print("\n==================================")
    print("--- Final Matrix Evaluation on Holdout Test Set ---")
    
    final_model = create_model().to(device)
    if os.path.exists(best_model_path):
        final_model.load_state_dict(torch.load(best_model_path, map_location=device))
    final_model.eval()
    
    all_preds = []
    all_probs = []
    all_labels = []
    
    with torch.no_grad():
        for X, y in test_loader:
            X, y = X.to(device), y.to(device)
            outputs = final_model(X)
            probs = outputs.cpu().numpy().flatten()
            all_probs.extend(probs)
            all_preds.extend((probs > 0.5).astype(int))
            all_labels.extend(y.cpu().numpy().flatten().astype(int))
            
    if all_labels:
        test_acc = accuracy_score(all_labels, all_preds)
        try:
            test_auc = roc_auc_score(all_labels, all_probs)
        except ValueError:
            test_auc = 0.0
            
        cm = confusion_matrix(all_labels, all_preds)
        
        print(f"\nFinal Extrapolated Test Accuracy: {test_acc:.4f}")
        if test_auc > 0:
            print(f"Final Test AUC Map Score: {test_auc:.4f}")
            
        print("\nGround Truth Confusion Matrix [TN, FP | FN, TP]:")
        print(cm)
    else:
        print("Test set is unexpectedly empty.")

if __name__ == "__main__":
    train()
