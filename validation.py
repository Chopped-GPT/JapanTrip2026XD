# validation.py
from datetime import date, timedelta

# UH Computer Science Degree Plan (2023–2024)
UH_COSC_PLAN = {
    1: {
        "Fall": ["COSC 1336", "MATH 2413", "ENGL 1301", "CORE US History", "CORE Language/Philosophy/Culture"],
        "Spring": ["COSC 1437", "MATH 2414", "ENGL 1302", "CORE US History", "CORE Elective"],
    },
    2: {
        "Fall": ["COSC 2425", "MATH 2305", "GOVT 2305", "Creative Arts", "NSM Science Lecture"],
        "Spring": ["COSC 2436", "GOVT 2306", "MATH 2318/3321", "NSM Science Lecture", "Social & Behavioral Science"],
    },
    3: {
        "Fall": ["COSC 3320", "COSC 3340", "MATH 3339", "CORE Writing in the Disciplines", "NSM Science Lecture+Lab"],
        "Spring": ["COSC 3360", "COSC 3380", "Capstone/Free Elective", "NSM Science Lecture+Lab"],
    },
    4: {
        "Fall": ["COSC XXXX (Advanced Elective)", "COSC XXXX (Advanced Elective)", "COSC 4351/4353 (Software Eng/Design)", "Capstone/Free Elective"],
        "Spring": ["COSC XXXX (Advanced Elective)", "COSC XXXX (Advanced Elective)", "Capstone/Free Elective"],
    },
}


def find_prerequisites(course_name: str) -> list:
    """
    Return simplified prerequisites for key UH COSC courses.
    (Based on typical dependencies — can be expanded.)
    """
    prereqs = {
        "COSC 1437": ["COSC 1336"],
        "COSC 2425": ["COSC 1437"],
        "COSC 2436": ["COSC 2425"],
        "COSC 3320": ["COSC 2436"],
        "COSC 3340": ["COSC 2436", "MATH 2305"],
        "COSC 3360": ["COSC 2436"],
        "COSC 4351": ["COSC 3320", "COSC 3360"],
        "COSC 4353": ["COSC 3320", "COSC 3360"],
    }
    return prereqs.get(course_name, [])


def generate_plan_from_major(major: str = "Computer Science") -> list:
    """
    Generate a realistic 4-year course plan for UH Computer Science students.
    """
    plan = []
    start_year = date.today().year

    for year, semesters in UH_COSC_PLAN.items():
        for term_name, courses in semesters.items():
            term = f"{term_name} {start_year + year - 1}"
            plan.append({
                "year": year,
                "term": term,
                "courses": courses
            })
    return plan


def estimate_graduation_date(terms_needed: int = 8) -> str:
    """
    Each term = ~4 months, 8 terms = ~32 months (≈4 years).
    """
    months_to_grad = terms_needed * 4
    grad_date = date.today() + timedelta(days=months_to_grad * 30)
    return grad_date.strftime("%B %Y")


def build_plan(normalized_data: dict) -> dict:
    """
    High-level function that builds a course plan and predicts graduation date
    for UH Computer Science students.
    """
    major = normalized_data.get("major", "Computer Science")
    plan = generate_plan_from_major(major)
    graduation = estimate_graduation_date()

    return {
        "student_info": normalized_data,
        "degree_plan": plan,
        "estimated_graduation": graduation
    }
