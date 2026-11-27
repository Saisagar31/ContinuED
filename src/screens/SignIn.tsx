import { useState, type FormEvent } from 'react';
import { useApp, useAsync } from '../app/context';
import { ErrorBox, Notice } from '../app/ui';
import { LangSelect } from '../app/LangSelect';
import { ThemeToggle } from '../app/ThemeToggle';
import { t } from '../content/i18n';
import { createTeacher, listTeachers, signIn } from '../store/db';

export function SignIn() {
  const { setWs, uiLang: L } = useApp();
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
      setError(t(L, 'signin.errPin'));
      setPin('');
      return;
    }
    location.hash = '#/';
    setWs(ws);
  }

  async function doCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError(t(L, 'signin.errName'));
    if (!/^\d{4,8}$/.test(pin)) return setError(t(L, 'signin.errPinFormat'));
    setBusy(true);
    try {
      const teacher = await createTeacher(name, pin);
      const ws = await signIn(teacher.id, pin);
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
      <div className="row between">
        <h1>ContinuED</h1>
        <div className="row"><LangSelect /><ThemeToggle /></div>
      </div>
      <div className="signin-intro">
        <p>{t(L, 'signin.tagline')}</p>
        <div className="art-stage welcome-stage" aria-hidden="true"><img className="classroom-art welcome-art" src="/illustrations/welcome-duo.png" width="672" height="448" alt="" /></div>
      </div>

      {showCreate ? (
        <form onSubmit={doCreate} className="card stack">
          <h2>{t(L, 'signin.newProfile')}</h2>
          <label>
            {t(L, 'signin.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label>
            {t(L, 'signin.choosePin')}
            <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" type="password" autoComplete="new-password" />
          </label>
          {error && <ErrorBox title={error} />}
          <button className="primary" disabled={busy}>{t(L, 'signin.create')}</button>
          {list.length > 0 && (
            <button type="button" className="link" onClick={() => { setCreating(false); setError(''); }}>{t(L, 'signin.backToProfiles')}</button>
          )}
        </form>
      ) : (
        <form onSubmit={doSignIn} className="card stack">
          <h2>{t(L, 'signin.who')}</h2>
          <div className="profile-list" role="radiogroup" aria-label={t(L, 'signin.who')}>
            {list.map((tch) => (
              <label key={tch.id} className={`profile ${selected === tch.id ? 'on' : ''}`}>
                <input type="radio" name="teacher" value={tch.id} checked={selected === tch.id} onChange={() => setSelected(tch.id)} />
                {tch.displayName}
              </label>
            ))}
          </div>
          {selected && (
            <label>
              {t(L, 'signin.pin')}
              <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" type="password" autoComplete="current-password" autoFocus />
            </label>
          )}
          {error && <ErrorBox title={error} />}
          <button className="primary" disabled={!selected || !pin || busy}>{t(L, 'signin.open')}</button>
          <button type="button" className="link" onClick={() => { setCreating(true); setPin(''); setError(''); }}>{t(L, 'signin.addAnother')}</button>
        </form>
      )}
      <Notice>{t(L, 'signin.note')}</Notice>
    </div>
  );
}
