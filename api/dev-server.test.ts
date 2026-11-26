import { afterEach, describe, expect, it, vi } from 'vitest';
import { devRouter, devVerifier } from './dev-server';

describe('dev server auth', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is refused when NODE_ENV=production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => devVerifier()).toThrow(/disabled/);
  });

  it('maps dev:<school>:<district>:<role> to Cognito-shaped claims and rejects anything else', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const v = devVerifier();
    expect(await v.verify('dev:S1:pune:teacher')).toEqual({ sub: 'dev-S1-teacher', 'custom:school_id': 'S1', 'custom:district': 'pune', 'cognito:groups': ['teacher'] });
    expect(await v.verify('dev:S1::school_lead')).not.toHaveProperty('custom:district');
    await expect(v.verify('eyJhbGciOi.fake.jwt')).rejects.toThrow();
  });

  it('dev router serves /health and protects /trust', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const route = await devRouter();
    expect((await route({ method: 'GET', path: '/health', query: {}, headers: {}, body: undefined })).status).toBe(200);
    expect((await route({ method: 'GET', path: '/trust', query: {}, headers: {}, body: undefined })).status).toBe(401);
  });
});
