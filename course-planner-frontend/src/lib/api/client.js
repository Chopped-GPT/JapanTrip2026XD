export const API_BASE =
  import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

/**
 * Generic response handler:
 * - throws on non-2xx
 * - returns null on 204 or empty body
 * - parses JSON only when body is non-empty and content-type says json
 */
async function handle(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = text || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  // No Content
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");

  if (!text) return null; // empty body, nothing to parse
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      // If server mislabeled or returned invalid JSON, surface a readable error
      throw new Error("Invalid JSON response from server.");
    }
  }

  // Not JSON: return raw text or null (most of our endpoints return JSON anyway)
  return text;
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
