import { describe, expect, it } from 'vitest';
import { createRouter } from './router';
import { handler } from './lambda';

describe('api skeleton', () => {
  it('GET /health returns ok', async () => {
    const res = await createRouter()({ method: 'GET', path: '/health', query: {}, headers: {}, body: undefined });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: 'continued-api' });
  });

  it('unknown route is 404', async () => {
    const res = await createRouter()({ method: 'GET', path: '/nope', query: {}, headers: {}, body: undefined });
    expect(res.status).toBe(404);
  });

  it('handler errors become a generic 500 without internals', async () => {
    const route = createRouter({
      'GET /boom': async () => {
        throw new Error('secret detail');
      },
    });
    const orig = console.error;
    console.error = () => {};
    const res = await route({ method: 'GET', path: '/boom', query: {}, headers: {}, body: undefined });
    console.error = orig;
    expect(res).toEqual({ status: 500, body: { error: 'internal' } });
  });

  it('lambda adapter maps an HTTP API v2 event', async () => {
    const res = await handler({ rawPath: '/health', requestContext: { http: { method: 'GET' } } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true });
  });

  it('lambda adapter rejects invalid JSON', async () => {
    const res = await handler({ rawPath: '/health', body: '{bad', requestContext: { http: { method: 'POST' } } });
    expect(res.statusCode).toBe(400);
  });
});
