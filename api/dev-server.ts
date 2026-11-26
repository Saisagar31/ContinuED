/**
 * Local development server: `npm run api:dev` → http://localhost:8787
 * Runs the same router as Lambda, over node:http. Not used in production.
 */
import { createServer } from 'node:http';
import type { TokenVerifier } from './src/auth';
import type { ApiRequest, Handler } from './src/http';
import { schoolRoutes } from './src/routes';
import { createRouter } from './src/router';
import { localSigner } from './src/signing';
import { memoryStore } from './src/store/memory';

export function serve(route: Handler, port = Number(process.env.API_PORT ?? 8787)) {
  const server = createServer(async (req, res) => {
    // Dev only: allow the Vite dev server to call us.
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();

    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    let body: unknown;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        return void res.end(JSON.stringify({ error: 'invalid_json' }));
      }
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
    const apiReq: ApiRequest = {
      method: req.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers,
      body,
    };
    const out = await route(apiReq);
    res.writeHead(out.status, { 'content-type': 'application/json', ...out.headers });
    res.end(out.body === undefined ? '' : JSON.stringify(out.body));
  });
  server.listen(port, () => console.log(`continued-api listening on http://localhost:${port}`));
  return server;
}

/**
 * DEV ONLY. Accepts "Bearer dev:<schoolId>:<district>:<role>" (district may be empty)
 * and turns it into the same claims a Cognito ID token carries. There is no signature:
 * anyone can claim any school. It lives in this file only, so it is never part of the
 * Lambda bundle (api/src/lambda.ts never imports dev-server.ts).
 */
export function devVerifier(): TokenVerifier {
  if (process.env.NODE_ENV === 'production') throw new Error('dev auth is disabled when NODE_ENV=production');
  return {
    async verify(token) {
      const m = /^dev:([^:]+):([^:]*):([a-z_]+)$/.exec(token);
      if (!m) throw new Error('not a dev token');
      return { sub: `dev-${m[1]}-${m[3]}`, 'custom:school_id': m[1], ...(m[2] ? { 'custom:district': m[2] } : {}), 'cognito:groups': [m[3]] };
    },
  };
}

export async function devRouter(): Promise<Handler> {
  const { signer, publicJwk } = await localSigner('dev-local-1');
  return createRouter(
    schoolRoutes({
      store: memoryStore(),
      verifier: devVerifier(),
      signer,
      trust: { keys: [{ kid: signer.kid, issuer: 'Dev School (local key)', publicJwk, notBefore: '2020-01-01', notAfter: '2099-12-31' }], revoked: [] },
      now: () => new Date(),
      config: { retentionDays: 365 },
    }),
  );
}

// Run directly (not when imported by tests).
if (process.argv[1] && /dev-server\.ts$/.test(process.argv[1])) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to start: the dev server uses fake dev auth and must not run with NODE_ENV=production.');
    process.exit(1);
  }
  console.warn(
    'WARNING: DEV AUTH ENABLED. Any "Bearer dev:<schoolId>:<district>:<role>" token is accepted without a signature.\n' +
      '         In-memory store (data is lost on exit) and a throwaway local signing key. Never expose this server.',
  );
  devRouter().then((route) => serve(route));
}
