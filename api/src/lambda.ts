/**
 * AWS Lambda entry point for an API Gateway HTTP API (payload format 2.0).
 * Only the fields we use are typed here, so no extra type package is needed.
 */
import { buildApp } from './app';
import type { ApiRequest, Handler } from './http';

interface HttpApiEventV2 {
  rawPath: string;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string } };
}

// Built on first request (not at import), from the Lambda environment. A config
// error fails that request with a generic 500 and is logged; it is retried next time.
let route: Handler | undefined;
function getRoute(): Handler {
  if (!route) route = buildApp(process.env);
  return route;
}

export async function handler(event: HttpApiEventV2) {
  let body: unknown;
  if (event.body) {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    try {
      body = JSON.parse(raw);
    } catch {
      return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'invalid_json' }) };
    }
  }
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers ?? {})) headers[k.toLowerCase()] = v;
  const req: ApiRequest = {
    method: event.requestContext.http.method,
    path: event.rawPath,
    query: event.queryStringParameters ?? {},
    headers,
    body,
  };
  let res;
  try {
    res = await getRoute()(req);
  } catch (e) {
    console.error('startup', e);
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'internal' }) };
  }
  return {
    statusCode: res.status,
    headers: { 'content-type': 'application/json', ...res.headers },
    body: res.body === undefined ? '' : JSON.stringify(res.body),
  };
}
