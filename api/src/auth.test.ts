import { generateKeyPairSync, sign as rsaSign, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authenticate, cognitoVerifier, type TokenVerifier } from './auth';
import type { ApiRequest } from './http';

const POOL = 'ap-south-1_TestPool1';
const CLIENT = 'testclient123';
const ISS = `https://cognito-idp.ap-south-1.amazonaws.com/${POOL}`;

const b64u = (s: string | Buffer) => (typeof s === 'string' ? Buffer.from(s) : s).toString('base64url');

function makeKey(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
}

function jwt(key: { kid: string; privateKey: KeyObject }, claims: Record<string, unknown>) {
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: key.kid, typ: 'JWT' }));
  const body = b64u(JSON.stringify(claims));
  const sig = rsaSign('RSA-SHA256', Buffer.from(`${head}.${body}`), key.privateKey);
  return `${head}.${body}.${b64u(sig)}`;
}

const req = (authorization?: string): ApiRequest => ({
  method: 'GET',
  path: '/trust',
  query: {},
  headers: authorization ? { authorization } : {},
  body: undefined,
});

describe('authenticate (claims mapping)', () => {
  const fixed = (claims: Record<string, unknown>): TokenVerifier => ({ verify: async () => claims });

  it('maps sub, school, district and known groups only', async () => {
    const r = await authenticate(
      req('Bearer x'),
      fixed({ sub: 'u1', 'custom:school_id': 'S-1', 'custom:district': 'pune', 'cognito:groups': ['teacher', 'admin', 'district_lead'] }),
    );
    expect(r).toEqual({ ok: true, auth: { sub: 'u1', schoolId: 'S-1', district: 'pune', roles: ['teacher', 'district_lead'] } });
  });

  it('no groups → no roles; no district → undefined', async () => {
    const r = await authenticate(req('Bearer x'), fixed({ sub: 'u1', 'custom:school_id': 'S-1' }));
    expect(r).toEqual({ ok: true, auth: { sub: 'u1', schoolId: 'S-1', roles: [] } });
  });

  it('missing or unsafe custom:school_id is 403', async () => {
    for (const school of [undefined, '', 'A#B', 'x'.repeat(65)]) {
      const r = await authenticate(req('Bearer x'), fixed({ sub: 'u1', 'custom:school_id': school }));
      expect(r.ok ? 0 : r.res.status).toBe(403);
    }
  });

  it('missing header, wrong scheme, or verifier throwing is 401', async () => {
    const throwing: TokenVerifier = { verify: async () => Promise.reject(new Error('expired')) };
    for (const h of [undefined, 'Basic abc', 'Bearer', 'Bearer a b']) {
      const r = await authenticate(req(h), fixed({ sub: 'u', 'custom:school_id': 'S' }));
      expect(r.ok ? 0 : r.res).toEqual({ status: 401, body: { error: 'unauthorized' } });
    }
    const r = await authenticate(req('Bearer x'), throwing);
    expect(r.ok ? 0 : r.res.status).toBe(401);
  });
});

describe('cognitoVerifier (aws-jwt-verify with a preloaded JWKS, no network)', () => {
  const key = makeKey('test-kid-1');
  const other = makeKey('test-kid-1'); // same kid, different key → bad signature
  const v = cognitoVerifier({ userPoolId: POOL, clientId: CLIENT, jwks: { keys: [key.jwk] } });
  const now = Math.floor(Date.now() / 1000);
  const base = {
    sub: 'staff-1',
    iss: ISS,
    aud: CLIENT,
    token_use: 'id',
    iat: now - 10,
    exp: now + 600,
    'custom:school_id': 'S-1',
    'cognito:groups': ['school_lead'],
  };

  it('valid ID token → AuthContext', async () => {
    const r = await authenticate(req(`Bearer ${jwt(key, base)}`), v);
    expect(r).toEqual({ ok: true, auth: { sub: 'staff-1', schoolId: 'S-1', roles: ['school_lead'] } });
  });

  it('expired, wrong audience, access token, wrong issuer and bad signature are all 401', async () => {
    const bad = [
      jwt(key, { ...base, exp: now - 60, iat: now - 3600 }),
      jwt(key, { ...base, aud: 'someone-else' }),
      jwt(key, { ...base, token_use: 'access' }),
      jwt(key, { ...base, iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_Other' }),
      jwt(other, base),
      'not.a.jwt',
    ];
    for (const t of bad) {
      const r = await authenticate(req(`Bearer ${t}`), v);
      expect(r.ok ? 0 : r.res.status).toBe(401);
    }
  });
});
