const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request(path, { method = 'GET', body, headers, signal } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const isForm = body instanceof FormData;

  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(isForm ? {} : body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    let msg = res.statusText;
    try { const err = await res.json(); msg = err.detail || err.message || msg; } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

export const http = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, data, opts) => request(p, { ...opts, method: 'POST', body: data }),
  put: (p, data, opts) => request(p, { ...opts, method: 'PUT', body: data }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
  upload(p, file, extra = {}, opts) {
    const form = new FormData();
    form.append('file', file);
    for (const [k, v] of Object.entries(extra)) form.append(k, v);
    return request(p, { ...opts, method: 'POST', body: form });
  },
};

// ✅ make sure this is exported
export function withQuery(path, params = {}) {
  const q = new URLSearchParams(params).toString();
  return q ? `${path}?${q}` : path;
}
