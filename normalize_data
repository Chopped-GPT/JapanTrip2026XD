import preferences

# normalize.py
from typing import Union

import re

# Default schema
DEFAULT_PREFERENCES = {
    "wantsSummerClasses": False,
    "wantsSpecificCourses": False
}

STANDARD_KEYS = ["major", "minor", "courses_taken", "target_graduation", "preferences"]

def normalize_student_input(student_input: Union[str, dict, None]) -> dict:
    """
    Standardize any student input (text or dict) to a consistent schema.

    Args:
        student_input: Raw text from PDF/text input, or a dict with partial data.

    Returns:
        dict: Normalized student data.
    """
    normalized = {key: None for key in STANDARD_KEYS}
    normalized["preferences"] = DEFAULT_PREFERENCES.copy()

    if isinstance(student_input, dict):
        for key in STANDARD_KEYS:
            if key in student_input:
                normalized[key] = student_input[key]
    elif isinstance(student_input, str):
        # Put raw text in courses_taken if no other info available
        normalized["courses_taken"] = student_input.strip()

    return normalized
