import { useState, type FormEvent } from 'react';
import { useApp, useAsync } from '../app/context';
import { ErrorBox, Notice } from '../app/ui';
import { createTeacher, listTeachers, signIn } from '../store/db';

export function SignIn() {
  const { setWs } = useApp();
  const teachers = useAsync(listTeachers, []);
  const [selected, setSelected] = useState<string>('');
  const [pin, setPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const list = teachers.data ?? [];
  const showCreate = creating || (!teachers.loading && list.length === 0);

  async function doSignIn(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const ws = await signIn(selected, pin);
    setBusy(false);
    if (!ws) {
      setError('That PIN does not match this profile. Try again.');
      setPin('');
      return;
    }
    location.hash = '#/';
    setWs(ws);
  }

  async function doCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Enter a name for this profile.');
    if (!/^\d{4,8}$/.test(pin)) return setError('PIN must be 4 to 8 digits.');
    setBusy(true);
    try {
      const t = await createTeacher(name, pin);
      const ws = await signIn(t.id, pin);
      location.hash = '#/';
      setWs(ws);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <h1>ContinuED</h1>
      <p className="muted">Carry what a learner knows to their next classroom.</p>

      {showCreate ? (
        <form onSubmit={doCreate} className="card stack">
          <h2>New teacher profile</h2>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label>
            Choose a PIN (4–8 digits)
            <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" type="password" autoComplete="new-password" />
          </label>
          {error && <ErrorBox title={error} />}
          <button className="primary" disabled={busy}>Create and open workspace</button>
          {list.length > 0 && (
            <button type="button" className="link" onClick={() => { setCreating(false); setError(''); }}>Back to profiles</button>
          )}
        </form>
      ) : (
        <form onSubmit={doSignIn} className="card stack">
          <h2>Who is using this phone?</h2>
          <div className="profile-list" role="radiogroup" aria-label="Teacher profiles">
            {list.map((t) => (
              <label key={t.id} className={`profile ${selected === t.id ? 'on' : ''}`}>
                <input type="radio" name="teacher" value={t.id} checked={selected === t.id} onChange={() => setSelected(t.id)} />
                {t.displayName}
              </label>
            ))}
          </div>
          {selected && (
            <label>
              PIN
              <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" type="password" autoComplete="current-password" autoFocus />
            </label>
          )}
          {error && <ErrorBox title={error} />}
          <button className="primary" disabled={!selected || !pin || busy}>Open my workspace</button>
          <button type="button" className="link" onClick={() => { setCreating(true); setPin(''); setError(''); }}>Add another teacher on this phone</button>
        </form>
      )}
      <Notice>
        Local profiles keep each teacher’s learners separate on a shared phone. School sign-in replaces this when staff
        accounts are ready (task 11). Use synthetic learners only until the pilot is approved.
      </Notice>
    </div>
  );
}
