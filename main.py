# main.py
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import uuid4
import os

# Optional PDF text extraction
try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

# ---------- Models ----------
class Prefs(BaseModel):
    days: List[str] = []
    timeOfDay: str = "Any"   # Morning | Afternoon | Evening | Any
    modality: str = "Any"    # In-person | Online | Hybrid | Any

class CourseBase(BaseModel):
    code: str
    title: str
    credits: int = Field(gt=0)
    term: str
    status: str = "planned"  # planned | completed
    grade: Optional[str] = None
    prefs: Prefs = Prefs()

class Course(CourseBase):
    id: str

class BuildScheduleIn(BaseModel):
    courses: List[Course]
    pdfIds: Optional[List[str]] = []
    chatSessionId: Optional[str] = None

# ---------- App ----------
app = FastAPI(title="Course Planner API")
router = APIRouter(prefix="/api")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory "DB"
DB: Dict[str, Any] = {"courses": {}}

# ---------- Courses CRUD ----------
@router.get("/courses", response_model=List[Course])
def list_courses():
    return list(DB["courses"].values())

@router.post("/courses", response_model=Course, status_code=201)
def create_course(body: CourseBase):
    cid = str(uuid4())
    saved = Course(id=cid, **body.dict())
    DB["courses"][cid] = saved
    return saved

@router.put("/courses/{course_id}", response_model=Course)
def update_course(course_id: str, body: CourseBase):
    if course_id not in DB["courses"]:
        raise HTTPException(status_code=404, detail="Course not found")
    cur: Course = DB["courses"][course_id]
    merged = cur.copy(update=body.dict())
    DB["courses"][course_id] = merged
    return merged

@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: str):
    DB["courses"].pop(course_id, None)

# ---------- PDF upload ----------
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/uploads/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    chars = 0
    if fitz is not None:
        try:
            text = ""
            with fitz.open(path) as doc:
                for page in doc:
                    text += page.get_text("text")
            chars = len(text)
        except Exception:
            chars = 0
    return {"id": str(uuid4()), "filename": file.filename, "chars": chars}

# ---------- NLP preferences (stub OK) ----------
class PrefsRequest(BaseModel):
    text: Optional[str] = None

@router.post("/nlp/preferences")
def extract_preferences(body: PrefsRequest):
    # You can call OpenAI here; for now just return a normalized stub
    return {
        "major": None,
        "minor": None,
        "courses_taken": body.text or None,
        "target_graduation": None,
        "preferences": {
            "wantsSummerClasses": False,
            "wantsSpecificCourses": False,
        },
    }

# ---------- Build schedule ----------
@router.post("/schedule/build")
def build_schedule(payload: BuildScheduleIn):
    """
    Very simple builder:
    - Puts each course on its preferred days (or Mon if none)
    - Bucketed by timeOfDay (Morning/Afternoon/Evening/Any)
    """
    week: Dict[str, List[Dict[str, Any]]] = {d: [] for d in ["Mon","Tue","Wed","Thu","Fri"]}
    for c in payload.courses:
        days = c.prefs.days or ["Mon"]
        time = c.prefs.timeOfDay if c.prefs.timeOfDay in ["Morning","Afternoon","Evening"] else "Any"
        for d in days:
            week.setdefault(d, [])
            week[d].append({"time": time, "code": c.code, "title": c.title})

    # Transform to the shape Schedule.jsx expects:
    buckets = {}
    for d in ["Mon","Tue","Wed","Thu","Fri"]:
        buckets[d] = {"Morning": [], "Afternoon": [], "Evening": [], "Any": []}
        for it in week.get(d, []):
            slot = it.get("time") if it.get("time") in ["Morning","Afternoon","Evening"] else "Any"
            buckets[d][slot].append({"code": it.get("code",""), "title": it.get("title","")})

    return {
        "week": buckets,
        "note": "Auto-built from course preferences.",
        "pdfIds": payload.pdfIds or [],
        "chatSessionId": payload.chatSessionId,
    }

@router.get("/health")
def health():
    return {"ok": True}

app.include_router(router)
