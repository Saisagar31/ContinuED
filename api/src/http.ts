/**
 * Transport-neutral request/response types. The same handlers run behind
 * API Gateway + Lambda (src/lambda.ts) and the local dev server (dev-server.ts).
 */
export interface ApiRequest {
  method: string;
  path: string; // without query string, e.g. "/health"
  query: Record<string, string>;
  headers: Record<string, string>; // lower-cased names
  body: unknown; // parsed JSON, or undefined
  /** Verified identity, set by the auth layer (task 11). Undefined = anonymous. */
  auth?: AuthContext;
}

export type Role = 'teacher' | 'school_lead' | 'district_lead';

export interface AuthContext {
  sub: string; // staff user ID from the identity provider
  schoolId: string; // tenant — every read and write is scoped to it
  district?: string;
  roles: Role[];
}

export interface ApiResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type Handler = (req: ApiRequest) => Promise<ApiResponse>;

export const json = (status: number, body: unknown): ApiResponse => ({ status, body });
export const error = (status: number, code: string, detail?: string): ApiResponse => ({
  status,
  body: detail ? { error: code, detail } : { error: code },
});
