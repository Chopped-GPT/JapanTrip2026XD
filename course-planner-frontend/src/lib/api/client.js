// src/lib/api/client.js
// Drop-in mock backend. Intercepts http calls and serves local data.
// All data lives in localStorage so your demo survives reloads.

const MOCK = true; // keep true for demo
export const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

const LS = {
  COURSES: "mock_courses_v1",
  PDFS: "mock_pdfs_v1",
  SCHEDULE: "mock_schedule_v1",
  CHAT: "mock_chat_v1",
};

function sleep(ms = 350) { return new Promise(r => setTimeout(r, ms)); }
function read(key, d=[]) { try { return JSON.parse(localStorage.getItem(key) ?? ""); } catch { return d; } }
function write(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function ensureSeed() {
  if (!read(LS.COURSES)) {
    write(LS.COURSES, [
      { id: crypto.randomUUID(), code: "COSC 1437", title: "Programming in C++", status:"completed", prefs:{days:["Mon","Wed"], timeOfDay:"Morning"} },
      { id: crypto.randomUUID(), code: "COSC 2436", title: "Data Structures", status:"completed", prefs:{days:["Tue","Thu"], timeOfDay:"Afternoon"} },
      { id: crypto.randomUUID(), code: "MATH 2413", title: "Calculus I", status:"completed", prefs:{days:["Mon","Wed"], timeOfDay:"Morning"} },
      { id: crypto.randomUUID(), code: "COSC 3340", title: "Automata & Computability", status:"planned", prefs:{days:["Mon","Wed"], timeOfDay:"Afternoon"} },
      { id: crypto.randomUUID(), code: "COSC 3360", title: "Database Systems", status:"planned", prefs:{days:["Tue","Thu"], timeOfDay:"Morning"} },
      { id: crypto.randomUUID(), code: "COSC 4351", title: "Software Engineering", status:"planned", prefs:{days:["Fri"], timeOfDay:"Morning"} },
    ]);
  }
  if (!read(LS.PDFS)) write(LS.PDFS, []);
  if (!read(LS.CHAT)) write(LS.CHAT, []);
}
ensureSeed();

// ---------- tiny helpers ----------
const json = (data) => ({ status: 200, json: async () => data });
const noContent = () => ({ status: 204, json: async () => null });

function buildSchedule(courses) {
  const DAYS = ["Mon","Tue","Wed","Thu","Fri"];
  const TIMES = ["Morning","Afternoon","Evening"];
  const plan = { Mon:[], Tue:[], Wed:[], Thu:[], Fri:[] };
  let di=0, ti=0;

  courses.filter(c => (c.status ?? "planned") === "planned").forEach(c => {
    const day = (c?.prefs?.days?.[0]) || DAYS[di++ % DAYS.length];
    const time = (c?.prefs?.timeOfDay && c.prefs.timeOfDay!=="Any") ? c.prefs.timeOfDay : TIMES[ti++ % TIMES.length];
    plan[day].push({ code: c.code, title: c.title, time });
  });

  const schedule = { note:"Mock schedule (frontend only).", week: plan };
  write(LS.SCHEDULE, schedule);
  return schedule;
}

function scriptedReply(text) {
  const t = (text || "").toLowerCase();
  // demo script
  if (t.includes("hi") || t.includes("hello")) {
    return "Hello! Share your completed classes (e.g., COSC 1437, COSC 2436) and I’ll suggest next courses.";
  }
  if (t.includes("1437") && t.includes("2436")) {
    return [
      "Great! Based on COSC 1437 & COSC 2436, here are solid next picks:",
      "• COSC 3340 — Automata & Computability",
      "• COSC 3360 — Database Systems",
      "• COSC 4351 — Fundamentals of Software Engineering",
      "Say: `switch 3340` if you’d like an alternative."
    ].join("\n");
  }
  if (t.includes("switch") && t.includes("3340")) {
    return "You can swap COSC 3340 with COSC 3320 — Algorithms & Data Structures II. You meet the prereqs and it’s offered next term.";
  }
  if (t.includes("make me a schedule") || t.includes("build my schedule")) {
    const schedule = buildSchedule(read(LS.COURSES, []));
    return "Done! I generated your schedule. Open the Schedule page.";
  }
  return "Got it! (mock reply). You can also say: `make me a schedule` to see the demo.";
}

// ---------- mock router ----------
async function mockFetch(path, { method="GET", headers={}, body=null } = {}) {
  await sleep(); // feel like a network

  // COURSES
  if (path.startsWith("/api/courses")) {
    const parts = path.split("/").filter(Boolean); // ['api','courses',':id?']
    const id = parts[2];
    let courses = read(LS.COURSES, []);

    if (method === "GET" && !id) return json(courses);

    if (method === "POST") {
      const payload = JSON.parse(body || "{}");
      const saved = { id: crypto.randomUUID(), status:"planned", ...payload };
      courses.unshift(saved);
      write(LS.COURSES, courses);
      return json(saved);
    }

    if (id && method === "PUT") {
      const payload = JSON.parse(body || "{}");
      courses = courses.map(c => c.id === id ? { ...c, ...payload } : c);
      write(LS.COURSES, courses);
      return json(courses.find(c => c.id === id));
    }

    if (id && method === "DELETE") {
      write(LS.COURSES, courses.filter(c => c.id !== id));
      return noContent();
    }
  }

  // FILE UPLOADS (PDF IDs only; no binary)
  if (path === "/api/uploads/pdf" && method === "POST") {
    const id = crypto.randomUUID();
    const list = read(LS.PDFS, []);
    list.push({ id, name: "Demo.pdf", size: 42_000 });
    write(LS.PDFS, list);
    return json({ id });
  }

  // CHAT
  if (path === "/api/nlp/preferences" && method === "POST") {
    const payload = JSON.parse(body || "{}");
    const reply = scriptedReply(payload.text || "");
    const history = read(LS.CHAT, []);
    history.push({ from:"user", text: payload.text || "" });
    history.push({ from:"bot", text: reply });
    write(LS.CHAT, history);
    return json({ reply });
  }

  // SCHEDULE BUILD
  if (path === "/api/schedule/build" && method === "POST") {
    const payload = JSON.parse(body || "{}");
    const schedule = buildSchedule(payload?.courses ?? read(LS.COURSES, []));
    return json(schedule);
  }

  // default
  return { status: 404, json: async () => ({ error: "Not found in mock." }) };
}

// -------------- public http API --------------
async function handle(res) {
  if (!res) throw new Error("No response");
  if (res.status >= 200 && res.status < 300) return res.json?.() ?? null;
  const msg = (await res.json?.())?.error || `${res.status}`;
  throw new Error(msg);
}

export const http = {
  get: async (path) => MOCK
    ? handle(await mockFetch(path, { method: "GET" }))
    : handle(await fetch(`${API_BASE}${path}`)),

  post: async (path, body) => MOCK
    ? handle(await mockFetch(path, { method: "POST", body: JSON.stringify(body ?? {}) }))
    : handle(await fetch(`${API_BASE}${path}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body ?? {}) })),

  put: async (path, body) => MOCK
    ? handle(await mockFetch(path, { method: "PUT", body: JSON.stringify(body ?? {}) }))
    : handle(await fetch(`${API_BASE}${path}`, { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body ?? {}) })),

  del: async (path) => MOCK
    ? handle(await mockFetch(path, { method: "DELETE" }))
    : handle(await fetch(`${API_BASE}${path}`, { method:"DELETE" })),

  upload: async (path/* , file, meta */) => MOCK
    ? handle(await mockFetch(path, { method: "POST" }))
    : handle(await fetch(`${API_BASE}${path}`, { method:"POST", body: new FormData() })),
};

export function withQuery(path, params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k,v]) => {
    if (v === undefined || v === null || v === "") return;
    Array.isArray(v) ? v.forEach(x => sp.append(k,x)) : sp.set(k,v);
  });
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}
