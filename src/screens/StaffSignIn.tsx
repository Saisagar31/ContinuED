/**
 * Optional school sign-in (task 11). The local PIN profile (SignIn.tsx) still opens the
 * workspace; this screen only connects that profile to school services (sync, signed
 * transfers, school trends). Everything else keeps working offline without it.
 *
 * Text comes from the language packs (staff.* keys in src/content/packs). STAFF_STRINGS
 * below is the English source those keys were created from; it is kept for reference.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../app/context';
import { t } from '../content/i18n';
import { ErrorBox, Notice } from '../app/ui';
import type { SessionState, SignInOutcome, StaffSession } from '../auth/session';

export const STAFF_STRINGS = {
  'staff.title': 'School sign-in',
  'staff.intro': 'Sign in with your school staff account to sync and to sign transfers. You only need this when you are online.',
  'staff.offline': 'Connect to the internet to sign in to school services — the app still works offline.',
  'staff.notConfigured': 'School sign-in is not set up in this version of the app. Everything else works on this phone.',
  'staff.email': 'School email',
  'staff.password': 'Password',
  'staff.submit': 'Sign in',
  'staff.newPasswordTitle': 'Choose a new password',
  'staff.newPasswordIntro': 'This is your first sign-in. Choose a new password of at least 12 characters with upper-case and lower-case letters and a number.',
  'staff.newPassword': 'New password',
  'staff.confirmPassword': 'Type the new password again',
  'staff.savePassword': 'Save password and sign in',
  'staff.mfaTitle': 'Enter your authenticator code',
  'staff.mfaIntro': 'Open your authenticator app and type the 6-digit code for ContinuED.',
  'staff.mfaCode': '6-digit code',
  'staff.verify': 'Verify',
  'staff.startOver': 'Start again',
  'staff.cancel': 'Not now',
  'staff.done': 'Done',
  'staff.signedInAs': 'Signed in to school services as',
  'staff.school': 'School',
  'staff.district': 'District',
  'staff.roles': 'Roles',
  'staff.signOut': 'Sign out of school services',
  'staff.reauth': 'Your school session has ended. Sign in again to sync.',
  'staff.trustWarn': 'Signed in, but the list of trusted schools could not be updated. Signed transfers from other schools may show as unknown until it updates.',
  'staff.err.not_authorized': 'Email or password is not correct. Try again.',
  'staff.err.user_not_found': 'Email or password is not correct. Try again.',
  'staff.err.password_reset_required': 'Your password must be reset. Ask your school administrator for help.',
  'staff.err.user_not_confirmed': 'This account is not active yet. Ask your school administrator.',
  'staff.err.too_many_requests': 'Too many attempts. Wait a few minutes, then try again.',
  'staff.err.code_mismatch': 'That code is not correct. Check your authenticator app and try again.',
  'staff.err.expired_code': 'That code has expired. Enter the newest code.',
  'staff.err.invalid_password': 'That password does not meet the rules. Use at least 12 characters with upper-case and lower-case letters and a number.',
  'staff.err.invalid_parameter': 'Something in the form is not valid. Check it and try again.',
  'staff.err.unsupported_challenge': 'This account needs a sign-in step the app does not support yet. Ask your school administrator.',
  'staff.err.network': 'Could not reach school services. Check the internet connection and try again.',
  'staff.err.bad_response': 'School services sent an unexpected reply. Try again later.',
  'staff.err.no_pending_challenge': 'This step has expired. Start again.',
  'staff.err.unknown': 'Sign-in failed. Try again later.',
  'staff.err.mismatch': 'The two passwords do not match.',
  'staff.err.tooShort': 'Use at least 12 characters.',
  'staff.err.codeFormat': 'Enter the 6 digits from your authenticator app.',
} as const;

export type StaffStringKey = keyof typeof STAFF_STRINGS;

type Step = 'credentials' | 'new_password' | 'mfa';

export function StaffSignIn({ session, onDone, onCancel }: { session: StaffSession | null; onDone?: () => void; onCancel?: () => void }) {
  const { online, uiLang } = useApp();
  const s = (k: StaffStringKey) => t(uiLang, k);
  const errText = (code: string) => (`staff.err.${code}` in STAFF_STRINGS ? s(`staff.err.${code}` as StaffStringKey) : s('staff.err.unknown'));
  const [state, setState] = useState<SessionState>(() => session?.state() ?? { status: 'signed_out' });
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!session) return;
    setState(session.state());
    return session.onChange(setState);
  }, [session]);

  // Move focus to the step heading so screen-reader users hear the new step.
  useEffect(() => {
    heading.current?.focus();
  }, [step, state.status]);

  if (!session) {
    return (
      <div className="signin">
        <h1 ref={heading} tabIndex={-1}>{s('staff.title')}</h1>
        <Notice>{s('staff.notConfigured')}</Notice>
        {onCancel && <button type="button" className="link" onClick={onCancel}>{s('staff.cancel')}</button>}
      </div>
    );
  }
  const sess = session;

  function after(out: SignInOutcome) {
    if (out.ok) {
      setPassword('');
      setNewPw('');
      setConfirmPw('');
      setCode('');
      setStep('credentials');
      onDone?.();
      return;
    }
    if ('challenge' in out) {
      setStep(out.challenge === 'NEW_PASSWORD_REQUIRED' ? 'new_password' : 'mfa');
      setPassword('');
      return;
    }
    setError(errText(out.error));
    // The Cognito session for the challenge is gone: go back to email + password.
    if (step !== 'credentials' && (out.error === 'not_authorized' || out.error === 'no_pending_challenge')) setStep('credentials');
  }

  async function run(fn: () => Promise<SignInOutcome>) {
    setError('');
    setBusy(true);
    try {
      after(await fn());
    } catch {
      setError(errText('unknown'));
    } finally {
      setBusy(false);
    }
  }

  function submitCredentials(e: FormEvent) {
    e.preventDefault();
    if (!online) return setError(s('staff.offline'));
    void run(() => sess.signIn(email, password));
  }

  function submitNewPassword(e: FormEvent) {
    e.preventDefault();
    if (newPw.length < 12) return setError(s('staff.err.tooShort'));
    if (newPw !== confirmPw) return setError(s('staff.err.mismatch'));
    if (!online) return setError(s('staff.offline'));
    void run(() => sess.completeNewPassword(newPw));
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    const c = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(c)) return setError(s('staff.err.codeFormat'));
    if (!online) return setError(s('staff.offline'));
    void run(() => sess.submitMfaCode(c));
  }

  function startOver() {
    setStep('credentials');
    setError('');
    setNewPw('');
    setConfirmPw('');
    setCode('');
  }

  if (state.status === 'signed_in' && state.profile) {
    const p = state.profile;
    return (
      <div className="signin">
        <h1 ref={heading} tabIndex={-1}>{s('staff.title')}</h1>
        <div className="card stack">
          <p>
            {s('staff.signedInAs')} <strong>{p.email ?? p.sub}</strong>
          </p>
          {p.schoolId && <p className="small">{s('staff.school')}: <span className="mono">{p.schoolId}</span></p>}
          {p.district && <p className="small">{s('staff.district')}: <span className="mono">{p.district}</span></p>}
          {p.roles.length > 0 && <p className="small">{s('staff.roles')}: {p.roles.join(', ')}</p>}
          {state.trustError && <Notice kind="warn">{s('staff.trustWarn')}</Notice>}
          <button type="button" onClick={() => void sess.signOut()}>{s('staff.signOut')}</button>
          {onDone && <button type="button" className="link" onClick={onDone}>{s('staff.done')}</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="signin">
      {!online && <Notice kind="warn"><span role="status">{s('staff.offline')}</span></Notice>}
      {state.status === 'reauth_required' && step === 'credentials' && <Notice kind="warn">{s('staff.reauth')}</Notice>}

      {step === 'credentials' && (
        <form onSubmit={submitCredentials} className="card stack" aria-labelledby="staff-h" noValidate>
          <h1 id="staff-h" ref={heading} tabIndex={-1}>{s('staff.title')}</h1>
          <p className="muted small">{s('staff.intro')}</p>
          <label>
            {s('staff.email')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email" required />
          </label>
          <label>
            {s('staff.password')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <ErrorBox title={error} />}
          <button className="primary" disabled={busy || !email.trim() || !password}>{s('staff.submit')}</button>
          {onCancel && <button type="button" className="link" onClick={onCancel}>{s('staff.cancel')}</button>}
        </form>
      )}

      {step === 'new_password' && (
        <form onSubmit={submitNewPassword} className="card stack" aria-labelledby="staff-h" noValidate>
          <h1 id="staff-h" ref={heading} tabIndex={-1}>{s('staff.newPasswordTitle')}</h1>
          <p className="muted small">{s('staff.newPasswordIntro')}</p>
          <label>
            {s('staff.newPassword')}
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" minLength={12} required />
          </label>
          <label>
            {s('staff.confirmPassword')}
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" minLength={12} required />
          </label>
          {error && <ErrorBox title={error} />}
          <button className="primary" disabled={busy || !newPw || !confirmPw}>{s('staff.savePassword')}</button>
          <button type="button" className="link" onClick={startOver}>{s('staff.startOver')}</button>
        </form>
      )}

      {step === 'mfa' && (
        <form onSubmit={submitCode} className="card stack" aria-labelledby="staff-h" noValidate>
          <h1 id="staff-h" ref={heading} tabIndex={-1}>{s('staff.mfaTitle')}</h1>
          <p className="muted small">{s('staff.mfaIntro')}</p>
          <label>
            {s('staff.mfaCode')}
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} required />
          </label>
          {error && <ErrorBox title={error} />}
          <button className="primary" disabled={busy || !code.trim()}>{s('staff.verify')}</button>
          <button type="button" className="link" onClick={startOver}>{s('staff.startOver')}</button>
        </form>
      )}
    </div>
  );
}
