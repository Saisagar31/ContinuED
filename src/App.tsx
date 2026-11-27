import { useEffect, useRef } from 'react';
import { go, useApp, useRoute } from './app/context';
import { LangSelect } from './app/LangSelect';
import { ThemeToggle } from './app/ThemeToggle';
import { LANG_NAMES, packState, t, type MsgKey } from './content/i18n';
import { SignIn } from './screens/SignIn';
import { Roster } from './screens/Roster';
import { LearnerDetail } from './screens/LearnerDetail';
import { Assess } from './screens/Assess';
import { Review } from './screens/Review';
import { TransferSlip } from './screens/TransferSlip';
import { Receive } from './screens/Receive';
import { PlanScreen } from './screens/PlanScreen';
import { Groups } from './screens/Groups';
import { Dashboard } from './screens/Dashboard';
import { StaffSignIn } from './screens/StaffSignIn';
import { AudioPacks } from './screens/AudioPacks';
import { API_URL } from './app/services';

const NAV: { path: string; label: MsgKey; icon: string }[] = [
  { path: '', label: 'nav.learners', icon: '👥' },
  { path: 'receive', label: 'nav.receive', icon: '⇩' },
  { path: 'groups', label: 'nav.groups', icon: '◫' },
  { path: 'dashboard', label: 'nav.trends', icon: '▤' },
];

export function App() {
  const { ws, setWs, uiLang, online, staff, staffState } = useApp();
  const route = useRoute();
  const main = useRef<HTMLElement>(null);

  // Move focus to the main region on navigation for screen-reader users.
  useEffect(() => {
    main.current?.focus();
  }, [route.join('/')]);

  // Screen readers and fonts pick the right script from the document language.
  useEffect(() => {
    document.documentElement.lang = LANG_NAMES[uiLang].bcp47;
  }, [uiLang]);

  if (!ws) return <SignIn />;

  const [head, a] = route;
  let screen;
  switch (head) {
    case 'learner': screen = <LearnerDetail id={a} />; break;
    case 'assess': screen = <Assess sessionId={a} />; break;
    case 'review': screen = <Review sessionId={a} />; break;
    case 'transfer': screen = <TransferSlip sessionId={a} />; break;
    case 'receive': screen = <Receive />; break;
    case 'plan': screen = <PlanScreen tid={a} />; break;
    case 'groups': screen = <Groups />; break;
    case 'dashboard': screen = <Dashboard />; break;
    case 'school': screen = <StaffSignIn session={staff} onDone={() => go('/')} onCancel={() => go('/')} />; break;
    case 'audio': screen = <AudioPacks />; break;
    default: screen = <Roster />;
  }
  const active = NAV.find((n) => n.path === (head ?? ''))?.path ?? (head === 'plan' ? 'receive' : '');

  return (
    <div className="shell">
      <header className="topbar no-print">
        <a className="brand" href="#/">ContinuED</a>
        <LangSelect />
        <ThemeToggle />
        <a className="link" href="#/audio">{t(uiLang, 'nav.audio')}</a>
        {API_URL && <a className="link" href="#/school">{t(uiLang, 'nav.school')}{staffState.status === 'signed_in' ? ' ✓' : ''}</a>}
        <button className="link" onClick={() => { setWs(null); go('/'); }} aria-label={`${t(uiLang, 'app.switch')}: ${ws.displayName}`}>
          {ws.displayName} · {t(uiLang, 'app.switch')}
        </button>
      </header>
      {!online && <div className="offline-bar no-print" role="status">{t(uiLang, 'app.offline')}</div>}
      {API_URL && <SyncLine />}
      {packState(uiLang) !== 'complete' && (
        <div className="draft-bar no-print" role="note">
          {t(uiLang, 'app.draftPack')}
        </div>
      )}
      <main ref={main} tabIndex={-1} className="main">{screen}</main>
      <nav className="tabbar no-print" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.path} href={`#/${n.path}`} aria-current={active === n.path ? 'page' : undefined}>
            <span aria-hidden="true">{n.icon}</span>
            {t(uiLang, n.label)}
          </a>
        ))}
      </nav>
    </div>
  );
}

/** One line on sync state, shown only when this build has school services. */
function SyncLine() {
  const { uiLang: L, online, staffState, sync, pendingCount } = useApp();
  let text: string | null = null;
  if (staffState.status !== 'signed_in' || sync.state === 'reauth_required') text = pendingCount > 0 ? t(L, 'sync.reauth') : null;
  else if (sync.state === 'syncing') text = t(L, 'sync.syncing');
  else if (!online || sync.state === 'offline') text = pendingCount > 0 ? t(L, 'sync.offline') : null;
  else if (sync.state === 'error') text = t(L, 'sync.error', { error: sync.lastError ?? '' });
  else if (pendingCount > 0) text = t(L, 'sync.pending', { n: pendingCount });
  else if (sync.lastSyncAt) text = t(L, 'sync.synced');
  if (!text) return null;
  const needsSignIn = staffState.status !== 'signed_in' || sync.state === 'reauth_required';
  return (
    <div className="draft-bar no-print" role="status">
      {needsSignIn ? <a href="#/school">{text}</a> : text}
    </div>
  );
}
