/**
 * Minimal Cognito user-pool client for staff sign-in (task 11). Plain fetch, no SDK.
 *
 * Calls the public Cognito Identity Provider JSON API:
 *   POST https://cognito-idp.<region>.amazonaws.com/
 *   Content-Type: application/x-amz-json-1.1
 *   X-Amz-Target: AWSCognitoIdentityProviderService.<Operation>
 * InitiateAuth and RespondToAuthChallenge are not authorised with IAM ("Amazon Cognito
 * doesn't evaluate IAM policies in requests for this API operation"), so a public app
 * client (no secret, see infra/template.yaml) sends them unsigned.
 *
 * Flows: USER_PASSWORD_AUTH (password goes over TLS to Cognito), REFRESH_TOKEN_AUTH,
 * and the NEW_PASSWORD_REQUIRED and SOFTWARE_TOKEN_MFA challenges. Any other challenge
 * (MFA_SETUP, SMS_MFA, ...) is reported as 'unsupported_challenge'.
 *
 * The ID token payload is decoded WITHOUT verifying the signature. That is only for
 * display and expiry timing; the school API verifies every token (api/src/auth.ts).
 */

export interface CognitoConfig {
  region: string;
  clientId: string;
}

export interface CognitoClientOptions extends CognitoConfig {
  fetch: typeof fetch;
}

/** Non-secret facts read from the ID token. */
export interface StaffProfile {
  sub: string;
  email?: string;
  schoolId?: string;
  district?: string;
  roles: string[];
}

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  /** Absent on a refresh when Cognito does not rotate the refresh token. */
  refreshToken?: string;
  /** ID token expiry, epoch milliseconds. */
  expiresAt: number;
  profile: StaffProfile;
}

export type AuthErrorCode =
  | 'not_authorized' // wrong password, or expired/revoked refresh token
  | 'user_not_found'
  | 'password_reset_required'
  | 'user_not_confirmed'
  | 'too_many_requests'
  | 'code_mismatch'
  | 'expired_code'
  | 'invalid_password' // new password breaks the pool's password policy
  | 'invalid_parameter'
  | 'unsupported_challenge'
  | 'network' // offline or Cognito unreachable
  | 'bad_response'
  | 'unknown';

export type SupportedChallenge = 'NEW_PASSWORD_REQUIRED' | 'SOFTWARE_TOKEN_MFA';

export type AuthResult =
  | { ok: true; session: CognitoTokens }
  | { ok: false; challenge: SupportedChallenge; session: string; username: string }
  | { ok: false; error: AuthErrorCode; message?: string };

export type RefreshResult = { ok: true; session: CognitoTokens } | { ok: false; error: AuthErrorCode; message?: string };

export interface CognitoClient {
  signIn(username: string, password: string): Promise<AuthResult>;
  completeNewPassword(username: string, session: string, newPassword: string): Promise<AuthResult>;
  submitMfaCode(username: string, session: string, code: string): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<RefreshResult>;
}

const ERROR_MAP: Record<string, AuthErrorCode> = {
  NotAuthorizedException: 'not_authorized',
  UserNotFoundException: 'user_not_found',
  PasswordResetRequiredException: 'password_reset_required',
  UserNotConfirmedException: 'user_not_confirmed',
  TooManyRequestsException: 'too_many_requests',
  CodeMismatchException: 'code_mismatch',
  ExpiredCodeException: 'expired_code',
  InvalidPasswordException: 'invalid_password',
  PasswordHistoryPolicyViolationException: 'invalid_password',
  InvalidParameterException: 'invalid_parameter',
};

/**
 * Error names come back as "__type" in the JSON body and/or the x-amzn-errortype header.
 * Some AWS JSON services prefix a namespace ("...#Name") or the header appends ":<url>",
 * so both are stripped.
 */
function errorName(body: unknown, headers: Headers): string {
  const raw = (body && typeof body === 'object' && typeof (body as { __type?: unknown }).__type === 'string'
    ? (body as { __type: string }).__type
    : headers.get('x-amzn-errortype')) ?? '';
  return raw.split(':')[0].split('#').pop() ?? '';
}

function b64urlToString(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Decodes a JWT payload. No signature check (see file header). Returns null if malformed. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const v: unknown = JSON.parse(b64urlToString(parts[1]));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Reads sub, email, custom:school_id, custom:district, cognito:groups and exp from an ID token. */
export function profileFromIdToken(idToken: string): { profile: StaffProfile; exp?: number } | null {
  const c = decodeJwtPayload(idToken);
  if (!c || typeof c.sub !== 'string' || c.sub === '') return null;
  const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);
  const groups = Array.isArray(c['cognito:groups']) ? c['cognito:groups'].filter((g): g is string => typeof g === 'string') : [];
  const profile: StaffProfile = { sub: c.sub, roles: groups };
  const email = str(c.email);
  const schoolId = str(c['custom:school_id']);
  const district = str(c['custom:district']);
  if (email) profile.email = email;
  if (schoolId) profile.schoolId = schoolId;
  if (district) profile.district = district;
  return { profile, exp: typeof c.exp === 'number' ? c.exp : undefined };
}

interface AuthenticationResult {
  AccessToken?: string;
  ExpiresIn?: number;
  IdToken?: string;
  RefreshToken?: string;
}

interface CognitoReply {
  AuthenticationResult?: AuthenticationResult;
  ChallengeName?: string;
  ChallengeParameters?: Record<string, string>;
  Session?: string;
}

export function createCognitoClient(opts: CognitoClientOptions): CognitoClient {
  const endpoint = `https://cognito-idp.${opts.region}.amazonaws.com/`;

  async function call(op: 'InitiateAuth' | 'RespondToAuthChallenge', payload: object): Promise<{ ok: true; body: CognitoReply } | { ok: false; error: AuthErrorCode; message?: string }> {
    let res: Response;
    try {
      res = await opts.fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `AWSCognitoIdentityProviderService.${op}` },
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, error: 'network' };
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      const name = errorName(body, res.headers);
      const message = body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string' ? (body as { message: string }).message : undefined;
      return { ok: false, error: ERROR_MAP[name] ?? 'unknown', ...(message ? { message } : {}) };
    }
    if (!body || typeof body !== 'object') return { ok: false, error: 'bad_response' };
    return { ok: true, body: body as CognitoReply };
  }

  function tokensFrom(r: AuthenticationResult, now = Date.now()): CognitoTokens | null {
    if (!r.IdToken || !r.AccessToken) return null;
    const parsed = profileFromIdToken(r.IdToken);
    if (!parsed) return null;
    const expiresAt = parsed.exp !== undefined ? parsed.exp * 1000 : now + (r.ExpiresIn ?? 0) * 1000;
    return { idToken: r.IdToken, accessToken: r.AccessToken, ...(r.RefreshToken ? { refreshToken: r.RefreshToken } : {}), expiresAt, profile: parsed.profile };
  }

  function toAuthResult(body: CognitoReply, username: string): AuthResult {
    if (body.AuthenticationResult) {
      const t = tokensFrom(body.AuthenticationResult);
      return t ? { ok: true, session: t } : { ok: false, error: 'bad_response' };
    }
    const name = body.ChallengeName;
    if ((name === 'NEW_PASSWORD_REQUIRED' || name === 'SOFTWARE_TOKEN_MFA') && body.Session) {
      // Later challenge responses need USERNAME; Cognito reports the canonical one as USER_ID_FOR_SRP.
      const canonical = body.ChallengeParameters?.USER_ID_FOR_SRP;
      return { ok: false, challenge: name, session: body.Session, username: canonical || username };
    }
    return { ok: false, error: name ? 'unsupported_challenge' : 'bad_response', ...(name ? { message: name } : {}) };
  }

  async function respond(challenge: SupportedChallenge, username: string, session: string, responses: Record<string, string>): Promise<AuthResult> {
    const r = await call('RespondToAuthChallenge', {
      ClientId: opts.clientId,
      ChallengeName: challenge,
      Session: session,
      ChallengeResponses: { USERNAME: username, ...responses },
    });
    return r.ok ? toAuthResult(r.body, username) : r;
  }

  return {
    async signIn(username, password) {
      const r = await call('InitiateAuth', {
        ClientId: opts.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username, PASSWORD: password },
      });
      return r.ok ? toAuthResult(r.body, username) : r;
    },
    completeNewPassword(username, session, newPassword) {
      return respond('NEW_PASSWORD_REQUIRED', username, session, { NEW_PASSWORD: newPassword });
    },
    submitMfaCode(username, session, code) {
      return respond('SOFTWARE_TOKEN_MFA', username, session, { SOFTWARE_TOKEN_MFA_CODE: code });
    },
    async refresh(refreshToken) {
      const r = await call('InitiateAuth', {
        ClientId: opts.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      });
      if (!r.ok) return r;
      const t = r.body.AuthenticationResult && tokensFrom(r.body.AuthenticationResult);
      return t ? { ok: true, session: t } : { ok: false, error: 'bad_response' };
    },
  };
}

/** Reads VITE_COGNITO_REGION / VITE_COGNITO_CLIENT_ID / VITE_API_URL. Null when any is empty (feature off). */
export function staffAuthConfigFromEnv(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): (CognitoConfig & { apiUrl: string }) | null {
  const region = env.VITE_COGNITO_REGION?.trim();
  const clientId = env.VITE_COGNITO_CLIENT_ID?.trim();
  const apiUrl = env.VITE_API_URL?.trim();
  return region && clientId && apiUrl ? { region, clientId, apiUrl } : null;
}
