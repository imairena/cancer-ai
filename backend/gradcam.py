import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F

def generate_gradcam_heatmap(model, input_tensor):
    import cv2
    model.eval()
    
    activations = []
    gradients = []
    
    def forward_hook(module, inp, out):
        activations.append(out)
        
    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])
        
    target_layer = model.backbone.features[-1]
    fh = target_layer.register_forward_hook(forward_hook)
    bh = target_layer.register_full_backward_hook(backward_hook)
    
    input_tensor = input_tensor.clone()
    input_tensor.requires_grad = True
    
    with torch.enable_grad():
        output = model(input_tensor)
        model.zero_grad()
        # Target the predicted malignant confidence across the 3-slice batch.
        loss = output[:, 0].mean()
        loss.backward()
        
    fh.remove()
    bh.remove()
    
    # Process layers natively mapping the 3-slice batched tensors
    A = activations[0] 
    G = gradients[0]
    
    weights = torch.mean(G, dim=[2, 3], keepdim=True)
    cam = torch.sum(weights * A, dim=1)
    cam = F.relu(cam)
    
    # Collapse 3 parallel depth slices down into a unified flat layer probability map
    cam = cam.mean(dim=0).detach().cpu().numpy()
    
    # Extract centre slice from t1c channel
    t1c_slice = input_tensor[1, 3, :, :].detach().cpu().numpy()
    
    # Normalise brain slice to 0-1
    t1c_min, t1c_max = t1c_slice.min(), t1c_slice.max()
    if t1c_max > t1c_min:
        t1c_slice = (t1c_slice - t1c_min) / (t1c_max - t1c_min)
    
    # Apply identical orientation correction to BOTH brain slice and heatmap
    cam = cv2.resize(cam, (224, 224))
    cam = np.rot90(cam, k=3)
    cam = np.flipud(cam)
    t1c_slice = np.rot90(t1c_slice, k=3)
    t1c_slice = np.flipud(t1c_slice)

    # Suppress corner/background artifacts by constraining CAM to brain tissue.
    brain_mask = (t1c_slice > 0.08).astype(np.float32)
    if brain_mask.max() > 0:
        cam = cam * brain_mask

    # Robust scaling avoids a single outlier pixel dominating the map.
    masked_values = cam[brain_mask > 0]
    if masked_values.size > 0:
        low = np.percentile(masked_values, 5)
        high = np.percentile(masked_values, 99)
        if high > low:
            cam = np.clip((cam - low) / (high - low), 0, 1)
        else:
            cam = np.zeros_like(cam)
    else:
        cam = np.zeros_like(cam)

    cam = cv2.GaussianBlur(cam, (9, 9), 0)
    if cam.max() > 0:
        cam = cam / cam.max()
    
    # Convert brain slice to RGB
    t1c_8bit = np.uint8(255 * t1c_slice)
    bg_rgb = cv2.cvtColor(t1c_8bit, cv2.COLOR_GRAY2RGB)
    
    # Apply colormap to heatmap
    cam_8bit = np.uint8(255 * cam)
    heatmap_color = cv2.applyColorMap(cam_8bit, cv2.COLORMAP_JET)
    
    # Overlay at 50% opacity
    overlay = cv2.addWeighted(bg_rgb, 0.5, heatmap_color, 0.5, 0)
    final_img_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
    
    plt.figure(figsize=(4, 4), dpi=100)
    plt.imshow(final_img_rgb)
    plt.axis('off')
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, transparent=True)
    plt.close()
    buf.seek(0)
    
    return buf.read()
