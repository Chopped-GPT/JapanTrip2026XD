# preferences2.py
"""
NLP routes for extracting/normalizing student preferences.
Exposes an APIRouter you can include from main.py:

    from preferences2 import router as nlp_router
    app.include_router(nlp_router)
"""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

# If you already have normalize_student_input in normalize.py, we'll use it.
# If import fails, we fall back to a safe stub.
try:
    from normalize import normalize_student_input  # your existing helper
except Exception:
    def normalize_student_input(student_input):
        # Minimal schema that the frontend can consume safely
        return {
            "major": None,
            "minor": None,
            "courses_taken": (student_input or None),
            "target_graduation": None,
            "preferences": {
                "wantsSummerClasses": False,
                "wantsSpecificCourses": False,
            },
        }

router = APIRouter(prefix="/api/nlp", tags=["nlp"])


class PrefsRequest(BaseModel):
    """
    Request body for /api/nlp/preferences
    """
    text: Optional[str] = None


@router.post("/preferences")
def extract_preferences(body: PrefsRequest):
    """
    Normalize free-text (or later, LLM output) into a stable JSON shape:
    {
      "major": str|None,
      "minor": str|None,
      "courses_taken": str|None,
      "target_graduation": str|None,
      "preferences": {
        "wantsSummerClasses": bool,
        "wantsSpecificCourses": bool
      }
    }
    """
    return normalize_student_input(body.text)
