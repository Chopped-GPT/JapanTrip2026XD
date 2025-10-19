from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import uuid4
import fitz  # PyMuPDF
import os

# ------------ Models -------------------------------------------------

class Prefs(BaseModel):
    days: List[str] = []
    timeOfDay: str = "Any"   # Any | Morning | Afternoon | Evening
    modality: str = "Any"    # Any | In-person | Online | Hybrid

class CourseBase(BaseModel):
    code: str
    title: str
    credits: int = Field(gt=0)
    term: str                # e.g., "Fall 2025"
    status: str = "planned"  # planned | completed
    grade: Optional[str] = None
    prefs: Prefs = Prefs()

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    credits: Optional[int] = Field(default=None, gt=0)
    term: Optional[str] = None
    status: Optional[str] = None
    grade: Optional[str] = None
    prefs: Optional[Prefs] = None

class Course(CourseBase):
    id: str

class BuildScheduleRequest(BaseModel):
    courses: List[Course]
    pdfIds: List[str] = []
    chatSessionId: Optional[str] = None

class NLPInput(BaseModel):
    text: Optional[str] = None

# ------------ App setup ----------------------------------------------

app = FastAPI(title="Course Planner API", version="0.1.0")
router = APIRouter(prefix="/api")

origins = [
    "http://localhost:5173",  # Vite
    "http://localhost:3000",  # CRA / Next dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory "DB"
memory_db: Dict[str, Any] = {
    "courses": {},     # id -> Course
    "pdf_store": {},   # id -> {"filename": ..., "text": ...}
}

# ------------ Helpers ------------------------------------------------

def extract_pdf_text(file_path: str) -> str:
    text = ""
    with fitz.open(file_path) as doc:
        for page in doc:
            # PyMuPDF new API is get_text
            text += page.get_text("text")
    return text

# ------------ Courses CRUD ------------------------------------------

@router.get("/courses", response_model=List[Course])
def list_courses():
    return list(memory_db["courses"].values())

@router.post("/courses", response_model=Course, status_code=201)
def create_course(payload: CourseCreate):
    new_id = str(uuid4())
    course = Course(id=new_id, **payload.dict())
    memory_db["courses"][new_id] = course
    return course

@router.put("/courses/{course_id}", response_model=Course)
def update_course(course_id: str, patch: CourseUpdate):
    if course_id not in memory_db["courses"]:
        raise HTTPException(status_code=404, detail="Course not found")
    current: Course = memory_db["courses"][course_id]
    data = current.dict()
    patch_dict = patch.dict(exclude_unset=True)
    # Shallow merge is fine here (Prefs is a model; whole-object replace if provided)
    data.update(patch_dict)
    updated = Course(**data)
    memory_db["courses"][course_id] = updated
    return updated

@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: str):
    if course_id not in memory_db["courses"]:
        raise HTTPException(status_code=404, detail="Course not found")
    del memory_db["courses"][course_id]
    return

# ------------ File uploads (PDF) ------------------------------------

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/uploads/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    text = extract_pdf_text(path)
    pdf_id = str(uuid4())
    memory_db["pdf_store"][pdf_id] = {"filename": file.filename, "text": text}
    return {"id": pdf_id, "filename": file.filename, "chars": len(text)}

# ------------ NLP preferences (stub) --------------------------------

@router.post("/nlp/preferences")
def extract_preferences(user_input: NLPInput):
    """
    Keep the *shape* you want to consume on the frontend/OpenAI step.
    """
    system_prompt = {
        "role": "system",
        "content": (
            "You are an academic advisor assistant that reads student free text "
            "and extracts a normalized JSON:\n"
            '{ "major": string|null, "minor": string|null, "courses_taken": string|null, '
            '"target_graduation": string|null, "preferences": { '
            '"wantsSummerClasses": boolean, "wantsSpecificCourses": boolean } }'
        ),
    }
    return {
        "message": "Stubbed—plug OpenAI here later.",
        "input": user_input.text,
        "schema": {
            "major": None,
            "minor": None,
            "courses_taken": user_input.text or None,
            "target_graduation": None,
            "preferences": {"wantsSummerClasses": False, "wantsSpecificCourses": False},
        },
        "system_prompt": system_prompt,
    }

# ------------ Build schedule (stub) ---------------------------------

@router.post("/schedule/build")
def build_schedule(req: BuildScheduleRequest):
    """
    Later: call your LLM/solver with req.courses + any parsed PDF/chat context.
    For now, just echo something plausible.
    """
    # Naive example: group planned courses under a fake M/W/F grid
    grid = {d: [] for d in ["Mon", "Tue", "Wed", "Thu", "Fri"]}
    for c in req.courses:
        days = c.prefs.days or ["Mon", "Wed"]
        slot = c.prefs.timeOfDay if c.prefs.timeOfDay != "Any" else "Morning"
        for d in days:
            grid.setdefault(d, []).append({"time": slot, "code": c.code, "title": c.title})
    return {
        "chatSessionId": req.chatSessionId,
        "pdfIds": req.pdfIds,
        "week": grid,
        "note": "Replace with real scheduling logic/LLM output.",
    }

app.include_router(router)
