# main.py
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import uuid4
import os
import shutil

# Optional PDF text extraction (PyMuPDF). It's fine if not installed.
try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

# =========================
# Models
# =========================

class Prefs(BaseModel):
    days: List[str] = []
    timeOfDay: str = "Any"   # Morning | Afternoon | Evening | Any
    modality: str = "Any"    # In-person | Online | Hybrid | Any

class CourseBase(BaseModel):
    code: str
    title: str
    credits: int = Field(gt=0)
    term: str
    status: str = "planned"            # planned | completed
    grade: Optional[str] = None
    prefs: Prefs = Prefs()

class Course(CourseBase):
    id: str

# For PUT updates where the UI may send only some fields
class CourseUpdate(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    credits: Optional[int] = Field(default=None, gt=0)
    term: Optional[str] = None
    status: Optional[str] = None
    grade: Optional[str] = None
    prefs: Optional[Prefs] = None

class BuildScheduleRequest(BaseModel):
    courses: List[Course]
    pdfIds: Optional[List[str]] = []
    chatSessionId: Optional[str] = None

# =========================
# App & CORS
# =========================

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
    allow_origins=origins,          # keep explicit for safety
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# In-memory stores
# =========================
db: Dict[str, Course] = {}          # course_id -> Course
pdf_store: Dict[str, str] = {}      # pdf_id -> temp_file_path

# =========================
# Courses CRUD
# =========================

@router.get("/courses", response_model=List[Course])
def list_courses():
    return list(db.values())

@router.post("/courses", response_model=Course, status_code=status.HTTP_201_CREATED)
def create_course(course: CourseBase):
    new_id = str(uuid4())
    saved = Course(id=new_id, **course.dict())
    db[new_id] = saved
    return saved

@router.put("/courses/{course_id}", response_model=Course)
def update_course(course_id: str, patch: CourseUpdate):
    if course_id not in db:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db[course_id]
    update_data = patch.dict(exclude_unset=True)

    # Shallow update is fine because frontend sends full prefs object when changed
    updated = existing.copy(update=update_data)

    # If prefs came in, ensure it’s the proper model
    if "prefs" in update_data and update_data["prefs"] is not None:
        updated.prefs = Prefs(**update_data["prefs"]) if isinstance(update_data["prefs"], dict) else update_data["prefs"]

    db[course_id] = updated
    return updated

@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: str):
    if course_id not in db:
        raise HTTPException(status_code=404, detail="Course not found")
    del db[course_id]
    return  # 204 No Content (frontend now handles this correctly)

# =========================
# File Uploads (PDF)
# =========================

@router.post("/uploads/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_id = str(uuid4())
    temp_path = f"temp_pdf_{pdf_id}.pdf"

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        pdf_store[pdf_id] = temp_path

        # Optional text extraction (safe if fitz missing)
        text = ""
        if fitz:
            try:
                with fitz.open(temp_path) as doc:
                    for page in doc:
                        text += page.get_text("text")
            except Exception as e:
                print(f"PDF read error: {e}")

        return {
            "pdfId": pdf_id,
            "filename": file.filename,
            "extracted_text_snippet": (text[:200] + "...") if text else "",
        }
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Failed to save/process file: {e}")

# =========================
# Build Schedule
# =========================

@router.post("/schedule/build")
def build_schedule(payload: BuildScheduleRequest):
    """
    Very simple builder:
    - Puts each course on its preferred days (or Mon if none)
    - Bucketed by timeOfDay (Morning/Afternoon/Evening/Any)
    """
    # Initialize 'week' to hold the raw list of course items for each day
    week: Dict[str, List[Dict[str, Any]]] = {d: [] for d in ["Mon","Tue","Wed","Thu","Fri"]}
    
    for c in payload.courses:
        # Use course preferences for scheduling
        days = c.prefs.days or ["Mon"]
        # Determine the time slot for the raw item
        time = c.prefs.timeOfDay if c.prefs.timeOfDay in ["Morning","Afternoon","Evening"] else "Any"
        
        for d in days:
            week.setdefault(d, [])
            # Add the raw item to the list for the specific day
            week[d].append({"time": time, "code": c.code, "title": c.title})

    # CRITICAL: Return the RAW 'week' structure. The frontend's Schedule.jsx
    # will handle the bucketing into Morning/Afternoon/Evening/Any slots.
    return {
        "week": week,
        "note": "Schedule built using a simple heuristic based on course preferences.",
        "chatSessionId": payload.chatSessionId,
        "pdfIds": payload.pdfIds,
    }

# =========================
# NLP (Preferences) Router
# =========================
# If you used the preferences2.py I gave you (exports APIRouter as `router`), include it.
# Otherwise we keep a local stub here.

try:
    from preferences2 import router as nlp_router  # <— uses the APIRouter version I provided
    app.include_router(nlp_router)
except Exception:
    class PrefsRequest(BaseModel):
        text: Optional[str] = None

    @router.post("/nlp/preferences")
    def nlp_preferences_stub(body: PrefsRequest):
        return {
            "major": None,
            "minor": None,
            "courses_taken": body.text or None,
            "target_graduation": None,
            "preferences": {"wantsSummerClasses": False, "wantsSpecificCourses": False},
        }

# Health (handy for quick checks)
@router.get("/health")
def health():
    return {"ok": True}

app.include_router(router)
