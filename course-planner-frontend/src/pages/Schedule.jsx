import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import "../css/pages/schedule.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TIMES = ["Morning", "Afternoon", "Evening", "Any"];

function normalize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const week = raw.week || {};
  const grid = {};
  for (const d of DAYS) {
    const items = Array.isArray(week[d]) ? week[d] : [];
    grid[d] = { Morning: [], Afternoon: [], Evening: [], Any: [] };
    for (const it of items) {
      const slot = TIMES.includes(it?.time) ? it.time : "Any";
      grid[d][slot].push({
        code: it?.code || "",
        title: it?.title || "",
      });
    }
  }
  return {
    grid,
    meta: {
      note: raw.note || "",
      chatSessionId: raw.chatSessionId ?? null,
      pdfIds: Array.isArray(raw.pdfIds) ? raw.pdfIds : [],
    },
  };
}

export default function Schedule({ data }) {
  const location = useLocation();
  const [raw, setRaw] = useState(() => {
    if (data) return data;
    if (location?.state) return location.state;
    try {
      const saved = localStorage.getItem("lastSchedule");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!raw) return;
    try {
      localStorage.setItem("lastSchedule", JSON.stringify(raw));
    } catch {}
  }, [raw]);

  const sched = useMemo(() => normalize(raw), [raw]);

  if (!sched) {
    return (
      <div className="schedule-page container max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-3">Schedule</h1>
        <div className="empty-state">
          No schedule data yet. Go to <strong>Courses</strong> → add a course →
          click <em>Build Schedule</em>.
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-page container max-w-6xl mx-auto p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Schedule</h1>
        {sched.meta.note && (
          <p className="legend mt-1">{sched.meta.note}</p>
        )}
      </header>

      <div className="legend mb-3">
        Grouped by Morning / Afternoon / Evening. Items with unknown time go to “Any”.
      </div>

      <div className="week-grid">
        {DAYS.map((day) => (
          <section key={day} className="day-card">
            <h2 className="day-title">{day}</h2>
            {TIMES.map((slot) => (
              <div key={slot} className="bucket">
                <div className="bucket-title">{slot}</div>
                {sched.grid[day][slot]?.length ? (
                  <ul className="course-list">
                    {sched.grid[day][slot].map((c, i) => (
                      <li key={i} className="course-item">
                        <div className="course-code">{c.code}</div>
                        <div className="course-title">{c.title}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="bucket-empty">(empty)</div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
