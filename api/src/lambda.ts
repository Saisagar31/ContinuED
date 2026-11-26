/**
 * AWS Lambda entry point for an API Gateway HTTP API (payload format 2.0).
 * Only the fields we use are typed here, so no extra type package is needed.
 */
import type { ApiRequest } from './http';
import { createRouter } from './router';

interface HttpApiEventV2 {
  rawPath: string;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string } };
}

const route = createRouter();

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
  const res = await route(req);
  return {
    statusCode: res.status,
    headers: { 'content-type': 'application/json', ...res.headers },
    body: res.body === undefined ? '' : JSON.stringify(res.body),
  };
}
