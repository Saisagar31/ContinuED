# ContinuED school services — infrastructure (task 11)

> **Status: NOT DEPLOYED.** `template.yaml` has never been run against an AWS account.
> It was only checked for YAML syntax. Run `sam validate --lint` first, and expect to fix things on the first staging deploy.

`template.yaml` (AWS SAM) creates, per stage (`staging` or `prod`):

| Resource | Purpose |
|---|---|
| Cognito user pool + app client (no secret) | Staff sign-in. Admin-only enrolment. Custom attributes `school_id` and `district`. Groups `teacher`, `school_lead` and `district_lead`. Users cannot write their own custom attributes. MFA is optional for now, because the PWA does not handle the TOTP setup challenge yet. |
| HTTP API + JWT authorizer | Checks Cognito ID tokens (`aud` = app client). `/health` is public. The Lambda checks the token a second time and enforces roles and tenant scope. |
| Lambda `continued-api-<stage>` | `api/dist/lambda.js` (nodejs22.x, arm64). |
| DynamoDB `continued-<stage>` | Single table (layout in `api/src/store/types.ts`). Provisioned 5/5, PITR on, TTL on `expiresAt`, deletion-protected by `Retain`. |
| KMS key (ECC_NIST_P256, SIGN_VERIFY) + alias `alias/continued-issuer-<stage>` | Issuer signing. The private key never leaves KMS. |
| IAM | The Lambda can only call DynamoDB `PutItem`, `UpdateItem`, `Query`, `DeleteItem`, `TransactWriteItems` and `ConditionCheckItem` on the table, plus `kms:Sign` on the key. |
| AWS Budget, $1/month | Emails at 80% actual and 100% forecast. |

**Costs to check before deploying.** I believe a customer-managed KMS key costs about $1/month, which alone may trigger the $1 budget. PITR is also billed per GB. Check current AWS pricing; I have not verified either figure.

## Deploy (staging)

Prerequisites: AWS SAM CLI and AWS CLI, signed in to the project account (task 05). Use MFA and do not use root credentials.

```bash
npm ci
npm run ci                 # must be green
npm run api:bundle         # writes api/dist/lambda.js (+ package.json marking it CommonJS)
cd infra
sam validate --lint
sam deploy --config-env staging \
  --parameter-overrides Stage=staging RetentionDays=365 \
    BudgetEmail=<team-alias@example.org> \
    AllowedOrigin=https://<staging-pwa-host> \
    IssuerKid=staging-2026a \
    TrustJson='{"keys":[],"revoked":[]}'
```

`--parameter-overrides` on the command line replaces the `parameter_overrides` in `samconfig.toml`, so pass the full set each time. The first deploy uses an empty trust list. Signing works after the first deploy, but no device can verify signatures until you publish the trust list (next section).

Stack outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `TableName` and `IssuerKeyArn`.

## Enrol staff

```bash
aws cognito-idp admin-create-user --user-pool-id <UserPoolId> --username teacher@example.org \
  --user-attributes Name=email,Value=teacher@example.org Name=email_verified,Value=true \
                    Name=custom:school_id,Value=SCH-0001 Name=custom:district,Value=pune
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> --username teacher@example.org --group-name teacher
```

`school_id` and `district` may only contain letters, digits, `_` and `-` (up to 64 characters). The API returns 403 for anything else.

**How the PWA signs in.** `src/auth/cognito.ts` uses the `USER_PASSWORD_AUTH` flow, so the app client allows `ALLOW_USER_PASSWORD_AUTH` (plus `ALLOW_USER_SRP_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`). With this flow the browser sends the password itself to Cognito, protected only by TLS. That is acceptable for the pilot. Moving the client to SRP (the password never leaves the phone) is a later hardening option; once it is done, remove `ALLOW_USER_PASSWORD_AUTH`. New users created with `admin-create-user` get a temporary password and must choose a new one at first sign-in (the app handles this `NEW_PASSWORD_REQUIRED` step). Users who have set up an authenticator app get the `SOFTWARE_TOKEN_MFA` step. The app cannot do authenticator *setup* (`MFA_SETUP`) yet, so MFA stays `OPTIONAL`. Keep refresh-token rotation off: Cognito does not accept `REFRESH_TOKEN_AUTH` when rotation is on.

## Publish the trust list

The trust list holds the issuer's **public** key as a JWK, its validity window, and any revoked kids. `GET /trust` serves it to signed-in devices, which keep it for offline verification.

1. Export the KMS public key (DER SubjectPublicKeyInfo) and convert it to a JWK:

   ```bash
   aws kms get-public-key --key-id alias/continued-issuer-staging --query PublicKey --output text > pub.b64
   node -e "const c=require('crypto');const der=Buffer.from(require('fs').readFileSync('pub.b64','utf8').trim(),'base64');const {kty,crv,x,y}=c.createPublicKey({key:der,format:'der',type:'spki'}).export({format:'jwk'});console.log(JSON.stringify({kty,crv,x,y}))"
   ```

2. Build `TrustJson`. The `kid` must equal `IssuerKid`. Dates are `YYYY-MM-DD` and are compared with the transfer's assessment date.

   ```json
   {"keys":[{"kid":"staging-2026a","issuer":"<School or district display name>","publicJwk":{"kty":"EC","crv":"P-256","x":"…","y":"…"},"notBefore":"2026-11-01","notAfter":"2027-12-31"}],"revoked":[]}
   ```

3. Redeploy with `TrustJson='<that JSON>'`. The Lambda rejects invalid JSON or a key that contains a private part (`d`) when it starts. The value is a Lambda environment variable, and Lambda limits all environment variables together to about 4 KB, which is enough for a few keys.

**Rotation.** Add a second `AWS::KMS::Key` to the template. Point `KMS_KEY_ID` at it and set a new `IssuerKid`. Add its public key to `TrustJson` next to the old one. Keep the old key in the list until its `notAfter`, so transfers it already signed keep verifying. Delete the old KMS key only after that date.

**Revocation.** Add the kid to `"revoked"` and redeploy. A device sees the change the next time it fetches `/trust`. A device that stays offline keeps its old list. The plan's "revocation freshness" rule (task 01) is still open.

## Not covered here (yet)

- No deploy has been run, so `sam validate`, IAM and the authorizer have not been tested against real AWS.
- There is no Lambda log-retention setting and there are no CloudWatch alarms (task 13).
- Restore-from-backup has not been rehearsed (task 13 evidence).
- There is no custom domain.
