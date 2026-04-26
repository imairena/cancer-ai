import io
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def generate_pdf_report(patient_id: str, probability: float, conf_low: float, conf_high: float) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    
    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, 750, "Brain Tumour Diagnostic Support Report")
    
    # Patient & Time info
    c.setFont("Helvetica", 12)
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.drawString(50, 710, f"Patient ID: {patient_id}")
    c.drawString(50, 690, f"Date and Time of Analysis: {current_time}")
    
    # Scan params
    c.drawString(50, 660, "Analysed Scan Channels: T1 (Native), T1ce (Contrast), T2w (Weighted), FLAIR")
    
    # Probabilities
    c.drawString(50, 620, f"Malignancy Probability: {probability * 100:.1f}%")
    c.drawString(50, 600, f"95% Confidence Interval: [{conf_low * 100:.1f}%, {conf_high * 100:.1f}%]")
    
    # Risk Level & Recommendation
    prob_percent = probability * 100
    if prob_percent <= 30.0:
        risk_level = "Low"
        rec = "Routine follow-up recommended"
    elif prob_percent <= 60.0:
        risk_level = "Moderate"
        rec = "Further imaging advised"
    else:
        risk_level = "High"
        rec = "Urgent specialist referral recommended"
        
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 560, f"Risk Classification: {risk_level} (0-30%: Low, 31-60%: Moderate, 61-100%: High)")
    c.drawString(50, 540, f"Recommended Next Step: {rec}")
    
    # Confidence Warning
    width = conf_high - conf_low
    c.setFont("Helvetica", 12)
    if width > 0.3:
        c.setFillColorRGB(0.8, 0, 0)
        c.drawString(50, 500, "WARNING: Confidence bounds are wide — recommend specialist review")
        c.setFillColorRGB(0, 0, 0)
        
    # PROMINENT Disclaimer Box
    c.setFillColorRGB(0.95, 0.95, 0.95)
    c.rect(40, 50, 530, 80, fill=1, stroke=1)
    
    c.setFillColorRGB(0.8, 0, 0)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 110, "CLINICAL DISCLAIMER & USAGE WARNING")
    
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, 90, "This AI-powered application is exclusively a DECISION-SUPPORT TOOL. It must NEVER")
    c.drawString(50, 75, "be used as a standalone or final clinical diagnosis tool.")
    c.drawString(50, 60, "Always defer to a qualified medical professional for final interpretation and treatment.")
    
    c.save()
    buf.seek(0)
    return buf.read()
