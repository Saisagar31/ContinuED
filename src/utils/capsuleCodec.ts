// STUB — owner: Omkar. Real implementation comes in task O6 (prompt P-O6).
// Callers must handle the "not implemented" error until then.
import type { CapsulePayload, DecodeResult } from '../types/capsule.ts';

export async function encodeCapsule(p: CapsulePayload): Promise<string> {
  void p;
  throw new Error('not implemented');
}

export async function decodeCapsule(raw: string): Promise<DecodeResult> {
  void raw;
  throw new Error('not implemented');
}
