import { error, json, type ApiRequest, type ApiResponse, type Handler } from './http';

export const API_VERSION = '0.1.0';

type RouteKey = `${string} ${string}`; // "GET /health"

/** Exact-match routes. Task 11 adds its routes through createRouter(extra). */
export function createRouter(extra: Partial<Record<RouteKey, Handler>> = {}): Handler {
  const routes: Partial<Record<RouteKey, Handler>> = {
    'GET /health': async () => json(200, { ok: true, service: 'continued-api', version: API_VERSION }),
    ...extra,
  };
  return async (req: ApiRequest): Promise<ApiResponse> => {
    const handler = routes[`${req.method.toUpperCase()} ${req.path}` as RouteKey];
    if (!handler) return error(404, 'not_found', `${req.method} ${req.path}`);
    try {
      return await handler(req);
    } catch (e) {
      // Never leak internals to the client; the message goes to the server log.
      console.error('unhandled', req.method, req.path, e);
      return error(500, 'internal');
    }
  };
}
