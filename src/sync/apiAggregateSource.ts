/**
 * AggregateSource backed by the school API's GET /aggregates (task 11), for the
 * dashboard (task 12). Drop-in replacement for fixtureSource().
 */
import { checkAggregateResponse } from '../../shared/guards';
import type { AggregateQuery, AggregateResponse, AggregateSource } from '../dashboard/aggregates';

export interface ApiSourceOptions {
  apiUrl: string;
  /** Current ID token, or null when the user must sign in again. */
  getToken: () => Promise<string | null>;
  fetch: typeof fetch;
}

/** Thrown for HTTP failures; `code` is the API error code (e.g. "unauthorized", "forbidden") when present. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`aggregates request failed: ${status} ${code}`);
  }
}

export function apiAggregateSource(opts: ApiSourceOptions): AggregateSource {
  return {
    async query(q: AggregateQuery): Promise<AggregateResponse> {
      const token = await opts.getToken();
      if (!token) throw new ApiError(401, 'unauthorized');
      const params = new URLSearchParams({ fromMonth: q.fromMonth, toMonth: q.toMonth });
      if (q.originLang) params.set('originLang', q.originLang);
      if (q.district) params.set('district', q.district);
      const res = await opts.fetch(`${opts.apiUrl.replace(/\/$/, '')}/aggregates?${params}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      if (!res.ok) {
        const code = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'http_error';
        throw new ApiError(res.status, code);
      }
      const bad = checkAggregateResponse(body);
      if (bad) throw new Error(`invalid aggregate response: ${bad}`);
      return body as AggregateResponse;
    },
  };
}
