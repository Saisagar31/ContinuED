/**
 * Production wiring (task 11): builds the router from environment variables set
 * by infra/template.yaml. Used by lambda.ts. The dev server has its own wiring.
 *
 *   TABLE_NAME           DynamoDB table
 *   USER_POOL_ID         Cognito user pool, e.g. ap-south-1_AbC123
 *   USER_POOL_CLIENT_ID  Cognito app client (ID tokens must have this audience)
 *   KMS_KEY_ID           KMS key ID/ARN/alias used for issuer signing
 *   ISSUER_KID           kid published in the trust list for that KMS key
 *   TRUST_JSON           {"keys":[...],"revoked":[...]} — public keys only
 *   RETENTION_DAYS       days to keep raw events (DynamoDB TTL); default 365
 */
import { checkTrustList } from '../../shared/guards';
import { cognitoVerifier } from './auth';
import type { Handler } from './http';
import { schoolRoutes, type TrustConfig } from './routes';
import { createRouter } from './router';
import { kmsSigner } from './signing';
import { dynamoStore } from './store/dynamo';

export function parseTrust(raw: string): TrustConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('TRUST_JSON is not valid JSON');
  }
  const p = parsed as Partial<TrustConfig>;
  const err = checkTrustList({ keys: p?.keys, revoked: p?.revoked, asOf: new Date().toISOString() });
  if (err) throw new Error(`TRUST_JSON invalid: ${err}`);
  return { keys: p.keys!, revoked: p.revoked! };
}

export function buildApp(env: Record<string, string | undefined>): Handler {
  const need = (name: string) => {
    const v = env[name];
    if (!v) throw new Error(`missing environment variable ${name}`);
    return v;
  };
  const retentionDays = Number(env.RETENTION_DAYS ?? 365);
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new Error('RETENTION_DAYS must be a positive integer');

  return createRouter(
    schoolRoutes({
      store: dynamoStore(need('TABLE_NAME')),
      verifier: cognitoVerifier({ userPoolId: need('USER_POOL_ID'), clientId: need('USER_POOL_CLIENT_ID') }),
      signer: kmsSigner(need('KMS_KEY_ID'), need('ISSUER_KID')),
      trust: parseTrust(need('TRUST_JSON')),
      now: () => new Date(),
      config: { retentionDays },
    }),
  );
}
