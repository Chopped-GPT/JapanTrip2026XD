import { useEffect, useMemo, useState } from "react";
import CourseList from "../components/CourseList.jsx";
import { CoursesAPI } from "../lib/api"; // list/create/update/remove

// style hooks for the nicer UI you asked for
import "../css/pages/courses.css";
import "../css/components/course-list.css";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

const initialForm = {
  code: "",
  title: "",
  credits: 3,
  term: "",
  status: "planned", // "planned" | "completed"
  grade: "",
  prefs: { days: [], timeOfDay: "Any", modality: "Any" },
};

export default function Courses() {
  // ---------- state ----------
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // If you save pdfIds from Builder, we can read them here (optional)
  const [pdfIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pdfIds") || "[]"); } catch { return []; }
  });
  const [chatSessionId] = useState(null);

  // ---------- load courses on mount ----------
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await CoursesAPI.list();
        if (!ignore) setCourses(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!ignore) setError(e.message || "Failed to load courses.");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // ---------- derived validation ----------
  const formErrors = useMemo(() => {
    const errs = {};
    if (!form.code.trim()) errs.code = "Course code is required.";
    if (!form.title.trim()) errs.title = "Title is required.";
    const cr = Number(form.credits);
    if (!Number.isFinite(cr) || cr <= 0) errs.credits = "Credits must be > 0.";
    if (!form.term.trim()) errs.term = "Term is required (e.g., Fall 2025).";
    if (form.status === "completed" && !form.grade.trim())
      errs.grade = "Add a grade or switch status to 'planned'.";
    return errs;
  }, [form]);

  const isFormValid = Object.keys(formErrors).length === 0;

  // ---------- helpers ----------
  function updateForm(path, value) {
    setForm(prev => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts.at(-1)] = value;
      return next;
    });
  }

  function toggleDay(day) {
    const s = new Set(form.prefs.days);
    s.has(day) ? s.delete(day) : s.add(day);
    updateForm("prefs.days", Array.from(s));
  }

  // ---------- create ----------
  async function handleAddCourse(e) {
    e.preventDefault();
    if (!isFormValid || saving) return;

    setSaving(true);
    setError("");
    const optimistic = { ...form, id: crypto.randomUUID(), credits: Number(form.credits) };
    setCourses(cur => [optimistic, ...cur]);
    setForm(initialForm);

    try {
      const saved = await CoursesAPI.create(optimistic);
      setCourses(cur => cur.map(c => (c.id === optimistic.id ? saved : c)));
    } catch (e) {
      setCourses(cur => cur.filter(c => c.id !== optimistic.id)); // rollback
      setError(e.message || "Failed to add course.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- update/delete (callbacks used by CourseList) ----------
  async function handleUpdateCourse(id, patch) {
    const prev = courses;
    setCourses(cur => cur.map(c => (c.id === id ? { ...c, ...patch } : c)));
    try {
      await CoursesAPI.update(id, patch);
    } catch (e) {
      setCourses(prev); // rollback
      setError(e.message || "Failed to update course.");
    }
  }

  async function handleDeleteCourse(id) {
    const prev = courses;
    setCourses(cur => cur.filter(c => c.id !== id));
    try {
      await CoursesAPI.remove(id);
    } catch (e) {
      setCourses(prev); // rollback
      setError(e.message || "Failed to delete course.");
    }
  }

  // ---------- build schedule ----------
  async function handleBuildSchedule() {
    if (courses.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/api/schedule/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses, pdfIds, chatSessionId }),
      });
      if (!r.ok) throw new Error(`POST /schedule/build failed: ${r.status}`);
      const schedule = await r.json();

      // keep it so Schedule.jsx can read it (no navigation here)
      localStorage.setItem("lastSchedule", JSON.stringify(schedule));
      console.log("Schedule:", schedule);
      alert("Schedule built! Open the Schedule page or check console.");
    } catch (e) {
      setError(e.message || "Failed to build schedule.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- render ----------
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const totalCredits = useMemo(
    () => courses.reduce((s, c) => s + Number(c.credits || 0), 0),
    [courses]
  );

  return (
    <div className="courses-page container max-w-4xl mx-auto p-4">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Courses</h1>
        <span className="badge">Total: {totalCredits} cr</span>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleAddCourse} className="grid gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col">
            <span className="text-sm mb-1">Course Code *</span>
            <input
              value={form.code}
              onChange={(e) => updateForm("code", e.target.value)}
              placeholder="COSC 2436"
              className="input"
            />
            {formErrors.code && <span className="hint-error">{formErrors.code}</span>}
          </label>

          <label className="flex flex-col md:col-span-2">
            <span className="text-sm mb-1">Title *</span>
            <input
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="Data Structures"
              className="input"
            />
            {formErrors.title && <span className="hint-error">{formErrors.title}</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col">
            <span className="text-sm mb-1">Credits *</span>
            <input
              type="number"
              value={form.credits}
              onChange={(e) => updateForm("credits", e.target.value)}
              min={0}
              className="input"
            />
            {formErrors.credits && <span className="hint-error">{formErrors.credits}</span>}
          </label>

          <label className="flex flex-col md:col-span-2">
            <span className="text-sm mb-1">Term *</span>
            <input
              value={form.term}
              onChange={(e) => updateForm("term", e.target.value)}
              placeholder="Fall 2025"
              className="input"
            />
            {formErrors.term && <span className="hint-error">{formErrors.term}</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col">
            <span className="text-sm mb-1">Status</span>
            <select
              value={form.status}
              onChange={(e) => updateForm("status", e.target.value)}
              className="input"
            >
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label className="flex flex-col md:col-span-2">
            <span className="text-sm mb-1">
              Grade {form.status === "completed" ? "*" : "(optional)"}
            </span>
            <input
              value={form.grade}
              onChange={(e) => updateForm("grade", e.target.value)}
              placeholder="A, B+, etc."
              disabled={form.status !== "completed"}
              className="input disabled:opacity-60"
            />
            {formErrors.grade && <span className="hint-error">{formErrors.grade}</span>}
          </label>
        </div>

        <div className="grid gap-3">
          <div>
            <span className="text-sm mb-1 block">Preferred Days</span>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`chip ${form.prefs.days.includes(d) ? "chip--active" : ""}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col">
              <span className="text-sm mb-1">Time of Day</span>
              <select
                value={form.prefs.timeOfDay}
                onChange={(e) => updateForm("prefs.timeOfDay", e.target.value)}
                className="input"
              >
                <option>Any</option>
                <option>Morning</option>
                <option>Afternoon</option>
                <option>Evening</option>
              </select>
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Modality</span>
              <select
                value={form.prefs.modality}
                onChange={(e) => updateForm("prefs.modality", e.target.value)}
                className="input"
              >
                <option>Any</option>
                <option>In-person</option>
                <option>Online</option>
                <option>Hybrid</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button disabled={!isFormValid || saving} className="btn btn-primary">
            {saving ? "Saving…" : "Add Course"}
          </button>
          <button type="button" onClick={() => setForm(initialForm)} className="btn">
            Reset
          </button>
        </div>
      </form>

      <section className="list-head">
        <h2>Your Courses</h2>
        <button
          type="button"
          onClick={handleBuildSchedule}
          disabled={courses.length === 0 || saving}
          className="btn btn-accent"
        >
          Build Schedule
        </button>
      </section>

      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : (
        <CourseList
          courses={courses}
          onUpdate={handleUpdateCourse}
          onDelete={handleDeleteCourse}
        />
      )}
    </div>
  );
}
