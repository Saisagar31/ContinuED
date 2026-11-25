import { EMPTY_TRUST, type TrustStore } from './trust';

const KEY = 'continued.trust.v1';

/** Public keys provisioned during online setup (task 11 supplies them). */
export function deviceTrustStore(): TrustStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrustStore) : EMPTY_TRUST;
  } catch {
    return EMPTY_TRUST;
  }
}
