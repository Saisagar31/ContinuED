import { error, json, type ApiRequest, type ApiResponse, type Handler } from './http';

export const API_VERSION = '0.1.0';

export type RouteKey = `${string} ${string}`; // "GET /health" or "DELETE /learners/{pseudonym}"

/** Matches one "{name}" path segment. Only whole segments can be parameters. */
const PARAM_RE = /^\{([A-Za-z]+)\}$/;

/**
 * Exact-match routes, plus routes with whole-segment "{name}" parameters
 * (added for task 11's DELETE /learners/{pseudonym}). Exact matches win.
 */
export function createRouter(extra: Partial<Record<RouteKey, Handler>> = {}): Handler {
  const routes: Partial<Record<RouteKey, Handler>> = {
    'GET /health': async () => json(200, { ok: true, service: 'continued-api', version: API_VERSION }),
    ...extra,
  };
  const patterns = Object.entries(routes)
    .filter(([key]) => key.includes('{'))
    .map(([key, handler]) => {
      const [method, path] = key.split(' ');
      return { method, segments: path.split('/'), handler: handler as Handler };
    });

  const matchPattern = (method: string, path: string): { handler: Handler; params: Record<string, string> } | null => {
    const parts = path.split('/');
    for (const p of patterns) {
      if (p.method !== method || p.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length && ok; i++) {
        const m = PARAM_RE.exec(p.segments[i]);
        if (m) {
          let v: string;
          try {
            v = decodeURIComponent(parts[i]);
          } catch {
            v = '';
          }
          if (v === '') ok = false;
          else params[m[1]] = v;
        } else if (p.segments[i] !== parts[i]) ok = false;
      }
      if (ok) return { handler: p.handler, params };
    }
    return null;
  };

  return async (req: ApiRequest): Promise<ApiResponse> => {
    const method = req.method.toUpperCase();
    // A literal "{...}" in the request path must not hit a pattern key by exact lookup.
    let handler = req.path.includes('{') ? undefined : routes[`${method} ${req.path}` as RouteKey];
    let routed = req;
    if (!handler) {
      const m = matchPattern(method, req.path);
      if (m) {
        handler = m.handler;
        routed = { ...req, params: m.params };
      }
    }
    if (!handler) return error(404, 'not_found', `${req.method} ${req.path}`);
    try {
      return await handler(routed);
    } catch (e) {
      // Never leak internals to the client; the message goes to the server log.
      console.error('unhandled', req.method, req.path, e);
      return error(500, 'internal');
    }
  };
}
