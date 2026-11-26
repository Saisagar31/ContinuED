import { afterAll, describe, expect, it, vi } from 'vitest';
import { createRouter } from './router';
import { handler } from './lambda';

describe('api skeleton', () => {
  afterAll(() => vi.unstubAllEnvs());
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

  it('lambda without configuration returns a generic 500 (no internals)', async () => {
    const orig = console.error;
    console.error = () => {};
    const res = await handler({ rawPath: '/health', requestContext: { http: { method: 'GET' } } });
    console.error = orig;
    expect(res).toMatchObject({ statusCode: 500, body: JSON.stringify({ error: 'internal' }) });
  });

  it('lambda adapter maps an HTTP API v2 event', async () => {
    // Placeholder values only: building the router makes no AWS calls.
    vi.stubEnv('TABLE_NAME', 'test-table');
    vi.stubEnv('USER_POOL_ID', 'ap-south-1_TestPool1');
    vi.stubEnv('USER_POOL_CLIENT_ID', 'testclientid');
    vi.stubEnv('KMS_KEY_ID', 'alias/test');
    vi.stubEnv('ISSUER_KID', 'k1');
    vi.stubEnv('TRUST_JSON', '{"keys":[],"revoked":[]}');
    const res = await handler({ rawPath: '/health', requestContext: { http: { method: 'GET' } } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true });
  });

  it('lambda adapter rejects invalid JSON', async () => {
    const res = await handler({ rawPath: '/health', body: '{bad', requestContext: { http: { method: 'POST' } } });
    expect(res.statusCode).toBe(400);
  });

  it('lambda: protected routes need a bearer token', async () => {
    const res = await handler({ rawPath: '/trust', requestContext: { http: { method: 'GET' } } });
    expect(res.statusCode).toBe(401);
  });
});

describe('path parameters', () => {
  const route = createRouter({
    'DELETE /learners/{pseudonym}': async (req) => ({ status: 200, body: req.params }),
    'GET /learners/list': async () => ({ status: 200, body: 'exact' }),
  });
  const req = (method: string, path: string) => route({ method, path, query: {}, headers: {}, body: undefined });

  it('extracts and decodes a whole-segment parameter', async () => {
    expect(await req('DELETE', '/learners/L-7K3Q')).toEqual({ status: 200, body: { pseudonym: 'L-7K3Q' } });
    expect(await req('delete', '/learners/a%20b')).toEqual({ status: 200, body: { pseudonym: 'a b' } });
  });

  it('does not match other methods, extra segments, empty values or the literal pattern', async () => {
    expect((await req('GET', '/learners/L-7K3Q')).status).toBe(404);
    expect((await req('DELETE', '/learners/L-7K3Q/x')).status).toBe(404);
    expect((await req('DELETE', '/learners/')).status).toBe(404);
    expect((await req('DELETE', '/learners/{pseudonym}')).status).toBe(200); // matched as a value, never by exact key
    expect((await req('DELETE', '/learners/%E0%A4')).status).toBe(404); // bad percent-encoding
    expect(await req('GET', '/learners/list')).toEqual({ status: 200, body: 'exact' });
  });
});
