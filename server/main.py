from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

app = FastAPI(title="Study Mate API")

# Enable CORS for React frontend (useful during development on separate ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from server.utils.file_parser import extract_text_from_pdf, extract_text_from_docx, clean_text
from server.utils.ai_engine import generate_exam_summary, generate_study_questions
from server.utils.database import save_study_session, save_quiz_result, get_study_history, clear_study_history
from server.utils.analytics import get_performance_analytics

@app.get("/api/health")
async def root():
    return {"status": "online", "message": "Study Mate AI Engine Running"}

@app.get("/history")
async def history():
    return get_study_history()

@app.delete("/history")
async def clear_history_endpoint():
    clear_study_history()
    return {"status": "cleared"}

@app.get("/stats")
async def stats():
    return get_performance_analytics()

@app.post("/parse-file")
async def parse_file(file: UploadFile = File(...)):
    name = file.filename.lower()
    content = await file.read()
    
    if name.endswith(".pdf"):
        text = extract_text_from_pdf(content)
    elif name.endswith(".docx"):
        text = extract_text_from_docx(content)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF or DOCX.")
    
    return {"text": clean_text(text)}

@app.post("/summarize")
async def summarize(payload: dict):
    text = payload.get("text", "")
    length = payload.get("length", 50)
    exam_mode = payload.get("examMode", True)
    explain_simply = payload.get("explainSimply", False)
    topic = payload.get("topic", "Extracted Material")
    language = payload.get("language", "English")
    
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
        
    result = generate_exam_summary(text, length, exam_mode, explain_simply, language)
    if not result:
        raise HTTPException(status_code=500, detail="AI processing failed")
    
    # Persist session - Use AI-detected topic if available, otherwise fallback to request topic
    final_topic = result.get("topic", topic)
    save_study_session(final_topic, text, result)
    
    return result

@app.post("/rephrase")
async def rephrase(payload: dict):
    text = payload.get("text", "")
    style = payload.get("style", "Academic")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    from server.utils.ai_engine import rephrase_text
    rephrased = rephrase_text(text, style)
    return {"rephrased": rephrased}

@app.post("/save-quiz")
async def save_quiz(payload: dict):
    session_id = payload.get("session_id")
    score = payload.get("score")
    total = payload.get("total")
    weak_topics = payload.get("weak_topics", [])
    save_quiz_result(session_id, score, total, weak_topics)
    return {"status": "saved"}

@app.post("/generate-mcqs")
async def generate_mcqs(payload: dict):
    text = payload.get("text", "")
    difficulty = payload.get("difficulty", "medium")
    print(f"Generating MCQs for text length: {len(text)}")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
        
    questions = generate_study_questions(text, difficulty)
    print(f"Generated {len(questions)} questions")
    return {"mcqs": questions}

# --- PORT UNIFICATION: SERVE FRONTEND ---

# Mount static files from 'dist' directory
if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

    # Catch-all route to serve index.html for React routing
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Prevent shadowing API routes by checking if path starts with known API prefixes if needed
        # but here we'll just serve index.html as a fallback
        index_path = os.path.join("dist", "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend build not found. Run 'npm run build' first."}
else:
    @app.get("/")
    async def root_fallback():
        return {"message": "Backend is running. Frontend build (dist/) not found. Port unification inactive."}

if __name__ == "__main__":
    # Allow configuring the port via environment for Codespaces or hosting platforms
    port = int(os.getenv("PORT") or os.getenv("FASTAPI_PORT") or 8000)
    # Use uvicorn programmatically so `python server/main.py` respects env vars
    uvicorn.run("server.main:app", host="0.0.0.0", port=port, reload=True)
