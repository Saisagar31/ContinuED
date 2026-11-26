/**
 * Frozen interface examples (plan section 3: "Include a successful example and
 * a failure example for each. Freeze compatible examples as automated fixtures.")
 *
 * Every folder here needs ok + fail. ok must validate; fail must be rejected
 * for the reason named in its "_expect" field. CI runs this, so changing a
 * contract in a breaking way, or breaking a fixture, fails the build.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as g from '../shared/guards';
import { decodeCapsule } from '../src/transfer/capsule';
import { EMPTY_TRUST } from '../src/transfer/trust';

const DIR = join(__dirname);
const read = (name: string, file: string) => readFileSync(join(DIR, name, file), 'utf8');
const readJson = (name: string, file: string) => JSON.parse(read(name, file)) as Record<string, unknown>;

const JSON_GUARDS: Record<string, (v: unknown) => string | null> = {
  'sync-batch': g.checkSyncBatch,
  'sync-ack': g.checkSyncAck,
  'sign-request': g.checkSignRequest,
  'sign-response': g.checkSignResponse,
  'trust-list': g.checkTrustList,
  'aggregate-query': g.checkAggregateQuery,
  'aggregate-response': g.checkAggregateResponse,
  'audio-manifest': g.checkAudioManifest,
  'content-pack': g.checkContentPack,
};

describe('fixtures', () => {
  it('every fixture folder has a guard (or is the capsule folder)', () => {
    const dirs = readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const d of dirs) expect(d === 'capsule' || d in JSON_GUARDS, `no guard for fixtures/${d}`).toBe(true);
  });

  for (const [name, guard] of Object.entries(JSON_GUARDS)) {
    it(`${name}: ok.json is valid`, () => {
      expect(guard(readJson(name, 'ok.json'))).toBeNull();
    });
    it(`${name}: fail.json is rejected for the expected reason`, () => {
      const fail = readJson(name, 'fail.json');
      expect(typeof fail._expect, `fixtures/${name}/fail.json needs an "_expect" field`).toBe('string');
      const err = guard(fail);
      expect(err).not.toBeNull();
      expect(err).toContain(fail._expect as string);
    });
  }

  it('capsule: ok.txt decodes with Venkat’s codec (unsigned → unverified)', async () => {
    const r = await decodeCapsule(read('capsule', 'ok.txt'), EMPTY_TRUST);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.trust).toBe('unverified');
      expect(r.envelope.ol).toBe('mr');
      expect(r.envelope.s.map((s) => s.skillId)).toEqual(['num.place_value', 'num.sub_borrow']);
    }
  });

  it('capsule: fail.txt (one character changed) is reported as damaged', async () => {
    const r = await decodeCapsule(read('capsule', 'fail.txt'), EMPTY_TRUST);
    expect(r).toMatchObject({ ok: false, reason: 'damaged' });
  });
});
