import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def upload_file_to_storage(bucket: str, path: str, file_bytes: bytes, content_type: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": content_type
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, content=file_bytes)
        if response.status_code not in (200, 201):
            raise Exception(f"Failed to upload to storage: {response.text}")
            
        return path

async def insert_diagnostic_result(data: dict):
    url = f"{SUPABASE_URL}/rest/v1/diagnostic-results"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=data)
        if response.status_code not in (201, 200):
            raise Exception(f"Failed to insert into db: {response.text}")
        return response.json()

async def get_doctor_cases(doctor_id: str):
    url = f"{SUPABASE_URL}/rest/v1/diagnostic-results?doctor_id=eq.{doctor_id}&select=*"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch cases: {response.text}")
        return response.json()
