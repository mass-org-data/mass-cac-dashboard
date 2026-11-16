// Opt-in client timing for load-time measurement. Disabled unless the page URL has
// ?perf=1 or localStorage 'mass-perf' is '1'. Records only the request path, method,
// timing, status and size. Never headers, bodies, tokens, query strings or records.
const enabled = () => {
  try { return new URLSearchParams(globalThis.location?.search || '').has('perf') || globalThis.localStorage?.getItem('mass-perf') === '1'; }
  catch { return false; }
};

export function perfMark(name) {
  if (!enabled()) return;
  try { globalThis.performance.mark(`mass:${name}`); } catch { /* timing is optional */ }
}

export function perfFetch() {
  return (input, init) => {
    if (!enabled()) return globalThis.fetch(input, init);
    const store = (globalThis.__massPerf ||= {requests: []});
    const raw = typeof input === 'string' ? input : input?.url || String(input);
    let path = raw;
    try { path = new URL(raw, globalThis.location?.href).pathname; } catch { /* keep raw path */ }
    const entry = {path, method: (init?.method || input?.method || 'GET').toUpperCase(), start: globalThis.performance.now()};
    store.requests.push(entry);
    return globalThis.fetch(input, init).then(
      response => { entry.end = globalThis.performance.now(); entry.status = response.status; entry.bytes = Number(response.headers.get('content-length')) || null; return response; },
      error => { entry.end = globalThis.performance.now(); entry.status = 0; entry.failed = true; throw error; },
    );
  };
}
