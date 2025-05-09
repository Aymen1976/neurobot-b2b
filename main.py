import os
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from fpdf import FPDF
from io import BytesIO
from dotenv import load_dotenv
import requests
import fitz  # PyMuPDF

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    message = data.get("message", "")

    if not GROQ_API_KEY:
        return JSONResponse(status_code=500, content={"error": "Clé API manquante"})

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama3-70b-8192",
        "messages": [
            {"role": "system", "content": "Tu es Neurobot, un expert professionnel en vente B2B et analyse de documents."},
            {"role": "user", "content": message}
        ]
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        reply = data['choices'][0]['message']['content']
        return {"response": reply.strip()}
    except Exception as e:
        print("❌ Erreur complète :", str(e))
        return JSONResponse(status_code=500, content={"error": "Erreur serveur."})

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()

    try:
        doc = fitz.open(stream=content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()

        extracted_text = text.strip()[:3000]  # Limite de contenu

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "llama3-70b-8192",
            "messages": [
                {"role": "system", "content": "Tu es un assistant expert en résumé de documents PDF."},
                {"role": "user", "content": f"Voici le contenu du document :\n\n{extracted_text}\n\nPeux-tu le résumer ?" }
            ]
        }

        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=15)
        response.raise_for_status()
        data = response.json()
        reply = data["choices"][0]["message"]["content"]
        return {"response": reply.strip()}

    except Exception as e:
        print("❌ Erreur analyse PDF :", str(e))
        return JSONResponse(status_code=500, content={"error": "Erreur lors de l’analyse du fichier."})

@app.post("/export-pdf")
async def export_to_pdf(messages: List[str] = Form(...)):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    for line in messages:
        pdf.multi_cell(0, 10, txt=line)

    buffer = BytesIO()
    pdf_bytes = pdf.output(dest='S').encode('latin1')
    buffer.write(pdf_bytes)
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="application/pdf", headers={
        "Content-Disposition": "attachment; filename=neurobot_conversation.pdf"
    })
