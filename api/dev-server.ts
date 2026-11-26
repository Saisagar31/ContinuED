/**
 * Local development server: `npm run api:dev` → http://localhost:8787
 * Runs the same router as Lambda, over node:http. Not used in production.
 */
import { createServer } from 'node:http';
import type { ApiRequest, Handler } from './src/http';
import { createRouter } from './src/router';

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

// Run directly (not when imported by tests).
if (process.argv[1] && /dev-server\.ts$/.test(process.argv[1])) serve(createRouter());
