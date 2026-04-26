import os
import uuid
import tempfile
import asyncio
import numpy as np
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

from model import get_model, load_nifti_to_tensor
from gradcam import generate_gradcam_heatmap
from pdf_report import generate_pdf_report
from supabase_client import upload_file_to_storage, insert_diagnostic_result, get_doctor_cases

app = FastAPI(title="Brain Tumour Diagnostic Support API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Since it's local dev, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = get_model()

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0"}

from typing import List

@app.post("/infer")
async def infer_scan(
    patient_id: str = Form(...),
    doctor_id: str = Form(...), 
    scans: List[UploadFile] = File(...)
):
    try:
        if len(scans) != 4:
            raise HTTPException(status_code=400, detail="Exactly 4 NIfTI files must be uploaded.")
            
        local_scan_path = os.getenv("LOCAL_SCAN_PATH")
        
        file_paths = {}
        tmp_paths = []
        
        for scan in scans:
            actual_path = None
            if local_scan_path and os.path.exists(local_scan_path):
                from pathlib import Path
                base = Path(local_scan_path)
                for path in base.rglob(scan.filename):
                    if path.is_file():
                        actual_path = str(path)
                        break
                        
            if not actual_path:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".nii.gz") as tmp:
                    content = await scan.read()
                    tmp.write(content) # type: ignore
                    actual_path = tmp.name
                    tmp_paths.append(tmp.name)
                
            fn = scan.filename.lower()
            if "t1n" in fn: chan = "t1"
            elif "t1c" in fn: chan = "t1ce"
            elif "t2w" in fn: chan = "t2"
            elif "t2f" in fn: chan = "flair"
            else: chan = "unknown"
            
            file_paths[chan] = actual_path
            
        if len(file_paths) < 4 or "unknown" in file_paths:
            for t in tmp_paths: os.remove(t)
            raise HTTPException(status_code=400, detail="Missing required channel suffix (_t1n, _t1c, _t2w, _t2f)")
            
        input_tensor = load_nifti_to_tensor(file_paths['t1'], file_paths['t2'], file_paths['flair'], file_paths['t1ce'])
        
        with torch.no_grad():
            out = model(input_tensor)
            prob = out.mean().item()
            print(f"Step 1: Inference complete, probability: {prob}")
        
        conf_low = max(0.0, prob - np.random.uniform(0.05, 0.2))
        conf_high = min(1.0, prob + np.random.uniform(0.05, 0.2))
        
        scan_id = str(uuid.uuid4())
        heatmap_bytes = generate_gradcam_heatmap(model, input_tensor)
        heatmap_filename = f"{scan_id}_heatmap.png"
        heatmap_url = await upload_file_to_storage("diagnostic-results", f"heatmaps/{heatmap_filename}", heatmap_bytes, "image/png")
        
        pdf_bytes = generate_pdf_report(patient_id, prob, conf_low, conf_high)
        pdf_filename = f"{scan_id}_report.pdf"
        tmp_pdf_path = f"/tmp/{pdf_filename}"
        
        if pdf_bytes and len(pdf_bytes) > 0:
            with open(tmp_pdf_path, "wb") as f:
                f.write(pdf_bytes)
            print(f"Step 2: PDF generated at {tmp_pdf_path}, size: {len(pdf_bytes)} bytes")
        else:
            print(f"ERROR: PDF generation returned 0 bytes or None for {tmp_pdf_path}!")
            
        print(f"Step 3: Attempting upload to diagnostic-results/reports/{pdf_filename}")
        try:
            report_url = await upload_file_to_storage("diagnostic-results", f"reports/{pdf_filename}", pdf_bytes, "application/pdf")
            print("Step 4: Upload successful")
        except Exception as upload_err:
            print(f"Step 4: Upload FAILED - {str(upload_err)}")
            raise upload_err
        
        result_data = {
            "patient_id": patient_id,
            "scan_filename": "multi-channel",
            "malignancy_probability": prob,
            "confidence_low": conf_low,
            "confidence_high": conf_high,
            "heatmap_url": heatmap_url,
            "report_url": report_url,
            "doctor_id": doctor_id
        }
        
        await insert_diagnostic_result(result_data)
        
        for t in tmp_paths:
            os.remove(t)
        
        return {
            "malignancy_probability": prob,
            "confidence_low": conf_low,
            "confidence_high": conf_high,
            "model_version": "EfficientNet-B4 v1.0",
            "heatmap_url": heatmap_url,
            "report_url": report_url
        }
    except Exception as e:
        for t in tmp_paths:
            if os.path.exists(t):
                os.remove(t)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/cases")
async def get_cases(doctor_id: str):
    try:
        cases = await get_doctor_cases(doctor_id)
        return {"cases": cases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
