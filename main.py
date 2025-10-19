# main.py
from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import uuid4
import fitz  # PyMuPDF
import os

# 🚨 NEW IMPORTS for LLM and Environment Setup
from openai import OpenAI, APIError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from normalize import normalize_student_input  # 🚨 Import the function

# ------------ LLM SETUP ----------------------------------------------

load_dotenv()

# Initialize the modern OpenAI client with error handling
try:
    client = OpenAI()
except Exception as e:
    print(f"FATAL: Failed to initialize OpenAI client. Error: {e}")
    client = None


# ------------ Models (No changes, reused from preferences2.py) ------

class Prefs(BaseModel):
    days: List[str] = []
    timeOfDay: str = "Any"  # Any | Morning | Afternoon | Evening
    modality: str = "Any"  # Any | In-person | Online | Hybrid


class CourseBase(BaseModel):
    code: str
    title: str
    credits: int = Field(gt=0)
    term: str  # e.g., "Fall 2025"
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

# 🚨 ADDED: Simple root route to fix the "Not Found" error when clicking the terminal link
@app.get("/")
def root_status():
    return {"message": "Backend is running! Access documentation at /docs."}


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
    "courses": {},  # id -> Course
    "pdf_store": {},  # id -> {"filename": ..., "text": ...}
}


# ------------ Helpers (No changes) -----------------------------------

def extract_pdf_text(file_path: str) -> str:
    text = ""
    # Assuming fitz is imported, otherwise this function will cause an error if called
    with fitz.open(file_path) as doc:
        for page in doc:
            text += page.get_text("text")
    return text


# ------------ Courses CRUD (No changes) ------------------------------

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


# ------------ File uploads (PDF) (No changes) ------------------------

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/uploads/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    # NOTE: extract_pdf_text will cause an error if fitz is not installed
    text = extract_pdf_text(path)
    pdf_id = str(uuid4())
    memory_db["pdf_store"][pdf_id] = {"filename": file.filename, "text": text}
    return {"id": pdf_id, "filename": file.filename, "chars": len(text)}


# ------------ NLP preferences (NOW USING normalize.py) -----------------

@router.post("/nlp/preferences")
def extract_preferences(user_input: NLPInput):
    """
    Uses normalize.py to standardize raw text input before any LLM processing.
    """
    # Requires normalize.py to be present and properly imported
    normalized_data = normalize_student_input(user_input.text)

    # 🚨 This is where you would call the LLM to extract major/graduation date from text

    return {
        "message": "Data normalized successfully (LLM extraction step skipped for now)",
        "input": user_input.text,
        "normalized_schema": normalized_data,
    }


# ------------ Build schedule (LLM INTEGRATION) ---------------------------------

@router.post("/schedule/build")
def build_schedule(req: BuildScheduleRequest):
    """
    Calls the LLM/solver with full course list and preferences.
    """
    if client is None:
        return JSONResponse(
            status_code=500,
            content={"detail": "OpenAI client failed to initialize at startup."}
        )

    # 1. Extract necessary data from the new, complex model
    taken_classes = [c.code for c in req.courses if c.status == "completed"]
    available_classes = [c.code for c in req.courses if c.status == "planned"]
    all_courses_data = [c.dict() for c in req.courses]

    # 2. Build the detailed prompt for the LLM
    prompt = f"""
    You are an AI academic scheduling assistant. 
    The student's full list of courses and current status is: {all_courses_data}
    Specifically, classes already taken are: {taken_classes}.
    Classes that still need to be scheduled are: {available_classes}.

    The student's preferences are embedded within the 'prefs' field of the course objects (days, timeOfDay, modality).
    Your task is to organize all 'planned' courses into a valid, plausible semester schedule.

    Respond in JSON format. The JSON should contain a key 'planned_schedule' which is a list 
    of dictionary objects, one for each course, and a key 'reasoning' explaining the choices.
    Each course object in 'planned_schedule' must include the course 'code' and a new 
    'suggested_term' field (e.g., 'Fall 2025', 'Spring 2026').
    """

    # 3. Call the API with error handling
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            timeout=15.0
        )

        ai_output = response.choices[0].message.content

        return {"ai_response": ai_output}

    except APIError as e:
        error_message = e.response.json().get('error', {}).get('message', 'Unknown API Error')
        print(f"OpenAI API Error ({e.status_code}): {error_message}")
        return JSONResponse(
            status_code=e.status_code if e.status_code is not None else 500,
            content={"detail": f"OpenAI API Error: {error_message}"}
        )
    except Exception as e:
        print(f"FATAL SERVER CRASH during API call: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal Server Crash: {e}"}
        )


app.include_router(router)