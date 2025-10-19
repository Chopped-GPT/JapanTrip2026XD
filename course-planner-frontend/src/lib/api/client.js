export const API_BASE =
  import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

async function handle(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = text || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    Array.isArray(v) ? v.forEach((x) => sp.append(k, x)) : sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function withQuery(path, params) {
  return `${path}${qs(params)}`;
}

export const http = {
  get: async (path) => handle(await fetch(`${API_BASE}${path}`)),

  post: async (path, body) =>
    handle(
      await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      })
    ),

  put: async (path, body) =>
    handle(
      await fetch(`${API_BASE}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      })
    ),

  del: async (path) =>
    handle(await fetch(`${API_BASE}${path}`, { method: "DELETE" })),

  // file: File or Blob, meta: { any extra fields }
  upload: async (path, file, meta = {}) => {
    const form = new FormData();
    form.append("file", file);
    Object.entries(meta).forEach(([k, v]) => form.append(k, v));
    return handle(
      await fetch(`${API_BASE}${path}`, {
        method: "POST",
        body: form,
      })
    );
  },
};
