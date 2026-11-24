export const APP_NAME = 'ContinuED';

export const CAPSULE_PREFIX = 'TC1:';

// DEMO ONLY: this key ships inside the app, so the seal is tamper-evident
// (it detects edited marks), not secure. Future: Ed25519 signatures from the
// state education department, with only the public key shipped in the app.
export const DEMO_HMAC_KEY = 'continued-demo-key-v1';
