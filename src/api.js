export async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, { ...options, signal: options.signal || controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } });
    let data;
    try { data = await response.json(); } catch { throw new Error('networkError'); }
    if (!response.ok) { const error = new Error(data.error || 'networkError'); Object.assign(error, { status: response.status, data }); throw error; }
    return data;
  } finally { clearTimeout(timer); }
}
export const post = (path, data) => api(path, { method: 'POST', body: JSON.stringify(data) });
