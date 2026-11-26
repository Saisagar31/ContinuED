/**
 * Staff authentication (task 11).
 *
 * Every protected route calls authenticate(): it reads "Authorization: Bearer <jwt>",
 * verifies it through an injected TokenVerifier, and maps the verified claims to an
 * AuthContext. The tenant (schoolId) comes ONLY from the verified token, never from
 * the request body or query.
 *
 * Production uses cognitoVerifier() (Cognito ID tokens via aws-jwt-verify). API
 * Gateway's JWT authorizer also checks the token; this is the second, in-process check.
 */
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { error, type ApiRequest, type ApiResponse, type AuthContext, type Role } from './http';

/** Verifies a raw JWT and returns its claims. Must throw for missing, invalid or expired tokens. */
export interface TokenVerifier {
  verify(token: string): Promise<Record<string, unknown>>;
}

export const ROLES: readonly Role[] = ['teacher', 'school_lead', 'district_lead'];

/** schoolId and district become parts of DynamoDB keys, so "#" and other separators are not allowed. */
const TENANT_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type AuthResult = { ok: true; auth: AuthContext } | { ok: false; res: ApiResponse };

export async function authenticate(req: ApiRequest, verifier: TokenVerifier): Promise<AuthResult> {
  const header = req.headers['authorization'] ?? '';
  const m = /^Bearer ([^\s]+)$/.exec(header);
  if (!m) return { ok: false, res: error(401, 'unauthorized') };

  let claims: Record<string, unknown>;
  try {
    claims = await verifier.verify(m[1]);
  } catch {
    // Do not say why (expired vs bad signature): the client action is the same — sign in again.
    return { ok: false, res: error(401, 'unauthorized') };
  }

  const sub = claims.sub;
  if (typeof sub !== 'string' || sub === '') return { ok: false, res: error(401, 'unauthorized') };

  const schoolId = claims['custom:school_id'];
  if (typeof schoolId !== 'string' || !TENANT_RE.test(schoolId)) {
    return { ok: false, res: error(403, 'forbidden', 'account is not enrolled in a school') };
  }

  const districtClaim = claims['custom:district'];
  let district: string | undefined;
  if (typeof districtClaim === 'string' && districtClaim !== '') {
    if (!TENANT_RE.test(districtClaim)) return { ok: false, res: error(403, 'forbidden', 'account district is invalid') };
    district = districtClaim;
  }

  const groups = claims['cognito:groups'];
  const roles = Array.isArray(groups) ? ROLES.filter((r) => groups.includes(r)) : [];

  return { ok: true, auth: { sub, schoolId, ...(district ? { district } : {}), roles } };
}

export const hasRole = (auth: AuthContext, ...roles: Role[]) => auth.roles.some((r) => roles.includes(r));

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  /** Tests only: preload a JWKS so verification needs no network. */
  jwks?: { keys: Record<string, unknown>[] };
}

/** Verifies Cognito ID tokens (signature, issuer, audience = clientId, token_use = id, expiry). */
export function cognitoVerifier(config: CognitoConfig): TokenVerifier {
  const v = CognitoJwtVerifier.create({ userPoolId: config.userPoolId, tokenUse: 'id', clientId: config.clientId });
  if (config.jwks) v.cacheJwks(config.jwks as unknown as Parameters<typeof v.cacheJwks>[0]);
  return {
    verify: async (token) => (await v.verify(token)) as unknown as Record<string, unknown>,
  };
}
