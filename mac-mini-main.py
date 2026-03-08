from fastapi import FastAPI, File, UploadFile, HTTPException, Security, Depends, BackgroundTasks, Header
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from typing import List, Optional
import pymupdf4llm
import instructor
from openai import OpenAI
import os
import uuid
import httpx

app = FastAPI(title="XMB CV Extractor v2")

# --- SICHERHEIT ---
API_KEY = "OT0LUb5W2Qxs6YVcMSWGKbRAh8xNEHhZ"
API_KEY_NAME = "Xmb-pdftojsonapi"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header == API_KEY:
        return api_key_header
    raise HTTPException(status_code=403, detail="Zugriff verweigert")

# --- DATENMODELLE (v2 — vollständig, kein Datenverlust) ---

class Language(BaseModel):
    sprache: str
    niveau: Optional[str] = None  # z.B. "B2", "C1", "Muttersprache", "fliessend"

class Experience(BaseModel):
    zeitraum: str
    rolle: str
    projekt_id: Optional[str] = None
    aufgaben: List[str]
    erfolge: List[str]
    herausforderungen_und_learnings: List[str]
    tools: List[str]

class Education(BaseModel):
    abschluss: str
    institution: str
    zeitraum: Optional[str] = None  # z.B. "2015 - 2019"

class CVData(BaseModel):
    # Persönliche Daten
    vorname: str
    nachname: str
    email: Optional[str] = None
    telefon: Optional[str] = None
    adresse: Optional[str] = None       # Strasse + Nr
    plz: Optional[str] = None
    ort: Optional[str] = None
    kanton: Optional[str] = None
    linkedin: Optional[str] = None
    geburtsdatum: Optional[str] = None
    nationalitaet: Optional[str] = None

    # Fachliches
    kernkompetenzen: List[str]
    sprachen: List[Language]
    erfahrungen: List[Experience]
    ausbildungen: List[Education]
    weiterbildungen: List[str]

    # Präferenzen
    gewuenschte_rolle: Optional[str] = None
    verfuegbar_ab: Optional[str] = None
    kuendigungsfrist: Optional[str] = None
    arbeitspensum: Optional[str] = None
    gewuenschter_lohn: Optional[str] = None

    # Catch-All — KEIN TEXT DARF VERLOREN GEHEN
    unklare_inhalte: Optional[str] = None
    sonstiger_text: Optional[List[str]] = None

# --- KI CLIENT SETUP ---
client = instructor.from_openai(
    OpenAI(
        base_url="http://127.0.0.1:8080/v1",
        api_key="not-needed"
    ),
    mode=instructor.Mode.JSON
)

SYSTEM_PROMPT = """Du bist ein präziser Daten-Extraktor für Lebensläufe (CVs). Extrahiere ALLE Informationen aus dem folgenden Lebenslauf im Markdown-Format.

KRITISCHE REGELN — KEIN DATENVERLUST ERLAUBT:
1. Extrahiere JEDE Information aus dem CV, auch wenn du dir nicht sicher bist wo sie hingehört.
2. Sprachen: Gib IMMER das Sprachniveau an wenn vorhanden (A1, A2, B1, B2, C1, C2, Muttersprache, fliessend, Grundkenntnisse etc.)
3. Kontaktdaten: Email, Telefon, Adresse (Strasse+Nr), PLZ, Ort, Kanton, LinkedIn — alles separat extrahieren.
4. Erfahrungen: projekt_id = Firmenname/Auftraggeber. Zeitraum im Format "MM/YYYY - MM/YYYY" oder "YYYY - heute".
5. Tools/Technologien aus den Erfahrungen gehören in das tools-Feld der jeweiligen Erfahrung UND in kernkompetenzen.
6. sonstiger_text: JEDER Text der nicht in die anderen Felder passt MUSS hier als Liste von Strings rein. Beispiele: Hobbys, Referenzen, Zusammenfassungen, Profiltext, Interessen, ehrenamtliche Tätigkeiten etc.
7. unklare_inhalte: Text den du nicht eindeutig zuordnen kannst.

ES DARF KEIN EINZIGER SATZ AUS DEM CV VERLOREN GEHEN. Lieber doppelt zuordnen als gar nicht.

Halte dich exakt an das geforderte JSON-Schema."""

# --- HINTERGRUND-TASK ---
def process_cv_task(temp_path: str, job_id: str, callback_url: str, callback_secret: str):
    try:
        # 1. PDF zu Markdown konvertieren
        md_text = pymupdf4llm.to_markdown(temp_path)

        # 2. LLM aufrufen
        extracted_data = client.chat.completions.create(
            model="mlx-community/Qwen2.5-14B-Instruct-4bit",
            response_model=CVData,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": md_text},
            ],
            temperature=0.0,
            max_tokens=8000,
        )

        # 3. Ergebnis per Webhook an Vercel zurückschicken
        with httpx.Client() as http_client:
            payload = {
                "job_id": job_id,
                "data": extracted_data.model_dump()
            }
            resp = http_client.post(
                callback_url,
                json=payload,
                headers={"X-Callback-Secret": callback_secret},
                timeout=30.0
            )
            print(f"✅ Job {job_id} → Callback {resp.status_code}")

    except Exception as e:
        print(f"❌ Fehler bei Job {job_id}: {e}")
        # Fehlerstatus an Vercel senden
        try:
            with httpx.Client() as http_client:
                http_client.post(
                    callback_url,
                    json={"job_id": job_id, "error": str(e)},
                    headers={"X-Callback-Secret": callback_secret},
                    timeout=10.0,
                )
        except Exception:
            pass

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# --- API ENDPUNKT ---
@app.post("/extract-cv/")
async def extract_cv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    api_key: str = Depends(get_api_key),
    x_job_id: Optional[str] = Header(None),
    x_callback_url: Optional[str] = Header(None),
    x_callback_secret: Optional[str] = Header(None),
):
    # Job-ID von Vercel übernehmen oder selbst generieren
    job_id = x_job_id or str(uuid.uuid4())

    # Callback-URL von Vercel übernehmen
    callback_url = x_callback_url
    callback_secret = x_callback_secret or ""

    if not callback_url:
        raise HTTPException(status_code=400, detail="X-Callback-Url Header fehlt")

    # Speicherordner sicherstellen und Datei ablegen
    os.makedirs("/Users/jarvis/cv_extractor_api/storage", exist_ok=True)
    temp_path = f"/Users/jarvis/cv_extractor_api/storage/{job_id}.pdf"

    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    print(f"📥 Job {job_id} empfangen → {file.filename}")

    # KI-Prozess in den Hintergrund schieben
    background_tasks.add_task(process_cv_task, temp_path, job_id, callback_url, callback_secret)

    return {
        "status": "processing",
        "job_id": job_id,
        "message": "PDF gesichert. Analyse läuft im Hintergrund."
    }

@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
