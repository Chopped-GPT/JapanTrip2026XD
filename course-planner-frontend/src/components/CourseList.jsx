import { useState } from "react";

export default function CourseList({ courses, onUpdate, onDelete }) {
  if (!courses?.length) {
    return <div className="empty">No courses yet. Add one above.</div>;
  }

  return (
    <ul className="course-list">
      {courses.map((c) => (
        <CourseRow
          key={c.id}
          course={c}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function CourseRow({ course, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(course);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function startEdit() {
    setDraft(course);
    setErr("");
    setEditing(true);
  }

  function change(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function changePrefs(field, value) {
    setDraft((d) => ({ ...d, prefs: { ...d.prefs, [field]: value } }));
  }

  function toggleDay(day) {
    const days = new Set(draft.prefs?.days || []);
    days.has(day) ? days.delete(day) : days.add(day);
    changePrefs("days", Array.from(days));
  }

  async function save() {
    setErr("");
    if (!draft.code?.trim()) return setErr("Course code is required.");
    if (!draft.title?.trim()) return setErr("Title is required.");
    const credits = Number(draft.credits);
    if (!Number.isFinite(credits) || credits <= 0)
      return setErr("Credits must be > 0.");
    if (!draft.term?.trim())
      return setErr("Term is required (e.g., Fall 2025).");
    if (draft.status === "completed" && !draft.grade?.trim())
      return setErr("Add a grade or set status to 'planned'.");

    setBusy(true);
    try {
      await onUpdate(course.id, {
        code: draft.code,
        title: draft.title,
        credits,
        term: draft.term,
        status: draft.status,
        grade: draft.grade || "",
        prefs: {
          days: draft.prefs?.days || [],
          timeOfDay: draft.prefs?.timeOfDay || "Any",
          modality: draft.prefs?.modality || "Any",
        },
      });
      setEditing(false);
    } catch (e) {
      setErr(e?.message || "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  }

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <li className="course-row">
      {!editing ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium">
              {course.code} — {course.title}
            </div>
            <div className="meta">
              {course.credits} cr • {course.term} • {course.status}
              {course.status === "completed" && course.grade
                ? ` • Grade: ${course.grade}`
                : ""}
              {course?.prefs?.days?.length
                ? ` • Days: ${course.prefs.days.join(", ")}`
                : ""}
              {course?.prefs?.timeOfDay && course.prefs.timeOfDay !== "Any"
                ? ` • ${course.prefs.timeOfDay}`
                : ""}
              {course?.prefs?.modality && course.prefs.modality !== "Any"
                ? ` • ${course.prefs.modality}`
                : ""}
            </div>
          </div>

          <div className="actions">
            <button className="btn" onClick={startEdit}>Edit</button>
            <button className="btn btn-danger" onClick={() => onDelete(course.id)}>
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {err && <div className="hint-error">{err}</div>}

          <div className="grid grid-cols-3 gap-2">
            <input
              className="input"
              value={draft.code || ""}
              onChange={(e) => change("code", e.target.value)}
              placeholder="COSC 2436"
            />
            <input
              className="input"
              value={draft.title || ""}
              onChange={(e) => change("title", e.target.value)}
              placeholder="Data Structures"
              style={{ gridColumn: "span 2" }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              className="input"
              type="number"
              min={0}
              value={draft.credits ?? 3}
              onChange={(e) => change("credits", e.target.value)}
            />
            <input
              className="input"
              value={draft.term || ""}
              onChange={(e) => change("term", e.target.value)}
              placeholder="Fall 2025"
              style={{ gridColumn: "span 2" }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select
              className="input"
              value={draft.status || "planned"}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
            </select>
            <input
              className="input"
              placeholder="Grade (if completed)"
              value={draft.grade || ""}
              onChange={(e) => change("grade", e.target.value)}
              disabled={draft.status !== "completed"}
              style={{ gridColumn: "span 2" }}
            />
          </div>

          {/* Preferences */}
          <div className="grid gap-2">
            <div>
              <span className="text-sm mb-1 block">Preferred Days</span>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={
                      "chip " +
                      ((draft.prefs?.days || []).includes(d) ? "chip--active" : "")
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                className="input"
                value={draft.prefs?.timeOfDay || "Any"}
                onChange={(e) => changePrefs("timeOfDay", e.target.value)}
              >
                <option>Any</option>
                <option>Morning</option>
                <option>Afternoon</option>
                <option>Evening</option>
              </select>

              <select
                className="input"
                value={draft.prefs?.modality || "Any"}
                onChange={(e) => changePrefs("modality", e.target.value)}
              >
                <option>Any</option>
                <option>In-person</option>
                <option>Online</option>
                <option>Hybrid</option>
              </select>
            </div>
          </div>

          <div className="actions">
            <button disabled={busy} className="btn btn-primary" onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button disabled={busy} className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
