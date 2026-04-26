# AI-Powered Brain Tumour Diagnostic System

An advanced full-stack application designed to analyze multi-channel 3D MRI brain scans in the NIfTI (.nii.gz) format. By utilizing deep learning algorithms, this platform offers real-time malignancy probabilities, interactive heatmaps for AI interpretability, and automatically generated PDF diagnostic reports safely stored in the cloud.

> **Disclaimer:** This tool is purely for decision support and demonstration purposes. It does not constitute an official clinical diagnosis. Always consult a qualified medical professional.

## ✨ Key Features
- 🧠 **NIfTI Multi-Modal Processing:** Handles 4-channel MRI uploads seamlessly (T1n, T1c, T2w, FLAIR arrays).
- 🤖 **Deep Learning Engine:** PyTorch-based `EfficientNet-B4 v1.0` dynamically generates accurate probability metrics and calculated confidence intervals.
- 🔍 **Grad-CAM Interpretability:** Automatically extracts standard brain slices, runs backwards propagation, and applies `np.rot90` & `np.flipud` mappings perfectly onto a 50% opacity jet-colored heatmap.
- 📄 **Automated PDF Reports:** Auto-generates shareable PDF files documenting individual scan assessments natively available via the dashboard.
- ☁️ **Supabase Integration:** Syncs reports and maps diagnostic cases securely to PostgreSQL columns and storage buckets using short-lived signed URLs.
- 💻 **Modern React Dashboard:** Vite + Tailwind CSS diagnostic interface combining elegance and medical clarity.

## 🛠 Tech Stack
- **Frontend:** React, React Router Dom, Vite, Tailwind CSS, Lucide Icons, Supabase-JS.
- **Backend:** FastAPI, Python, PyTorch, OpenCV (cv2), HTTPX, python-dotenv.
- **Database & Storage:** Supabase (Postgres & S3-compatible Object Storage).

## 🚀 Getting Started

### Prerequisites
- Node.js & npm (latest LTS recommended)
- Python 3.10+
- Supabase Account & Project ID

### 1. Database & Cloud Setup (Supabase)
1. In your Supabase Dashboard, create a table named `diagnostic-results`.
2. Create a public/private storage bucket named `diagnostic-results` containing two sub-folders: `/heatmaps` and `/reports`.
3. Locate your project's connection URL and Anon/Service Role Keys.

### 2. Backend Installation 
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Copy and fill your backend `.env`:
```env
SUPABASE_URL=https://<your_supabase_id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
# Include locally required specific vars (like LOCAL_SCAN_PATH)
```
Start the backend server on `localhost:8000`:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Installation
```bash
cd frontend
npm install
```
Copy and fill your frontend `.env`:
```env
VITE_SUPABASE_URL=https://<your_supabase_id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
```
Start the frontend interface:
```bash
npm run dev
```

## 📸 Usage & UI Flow
1. Navigate to the dashboard.
2. Hit **New Scan** and drag-and-drop the `.nii.gz` sequences (It requires exactly 4 valid modal types: `_t1n`, `_t1c`, `_t2w`, `_t2f`).
3. Click "Analyze Scans". The backend instantly unbundles the modalities, maps tensors to the PyTorch Backbone, and writes probabilities.
4. Review the analytical report complete with the **Grad-CAM Hotspot Tracker** mapped successfully to the center coordinate slice without any orientation drift! 
5. Download your authenticated PDF file.

---
*Built as an ambitious demonstrative AI medical dashboard.*
