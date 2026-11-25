import { useEffect, useRef } from 'react';
import { go, useApp, useRoute } from './app/context';
import { LANG_NAMES, packState } from './content/i18n';
import { LANGS, type LangCode } from './domain/types';
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

const NAV = [
  { path: '', label: 'Learners', icon: '👥' },
  { path: 'receive', label: 'Receive', icon: '⇩' },
  { path: 'groups', label: 'Groups', icon: '◫' },
  { path: 'dashboard', label: 'Trends', icon: '▤' },
];

export function App() {
  const { ws, setWs, uiLang, setUiLang, online } = useApp();
  const route = useRoute();
  const main = useRef<HTMLElement>(null);

  // Move focus to the main region on navigation for screen-reader users.
  useEffect(() => {
    main.current?.focus();
  }, [route.join('/')]);

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
    default: screen = <Roster />;
  }
  const active = NAV.find((n) => n.path === (head ?? ''))?.path ?? (head === 'plan' ? 'receive' : '');

  return (
    <div className="shell">
      <header className="topbar no-print">
        <a className="brand" href="#/">ContinuED</a>
        <label className="lang-select">
          <span className="sr-only">Interface language</span>
          <select value={uiLang} onChange={(e) => setUiLang(e.target.value as LangCode)} aria-label="Interface language">
            {LANGS.map((l) => (
              <option key={l} value={l}>{LANG_NAMES[l].native}</option>
            ))}
          </select>
        </label>
        <button className="link" onClick={() => { setWs(null); go('/'); }} aria-label={`Sign out ${ws.displayName}`}>
          {ws.displayName} · Switch
        </button>
      </header>
      {!online && <div className="offline-bar no-print" role="status">Offline — work is saved on this phone</div>}
      {packState(uiLang) !== 'complete' && (
        <div className="draft-bar no-print" role="note">
          {packState(uiLang) === 'draft'
            ? `${LANG_NAMES[uiLang].english}: partial unreviewed draft — other text in English (review pending, task 09)`
            : `${LANG_NAMES[uiLang].english} interface not yet available — showing English (task 09)`}
        </div>
      )}
      <main ref={main} tabIndex={-1} className="main">{screen}</main>
      <nav className="tabbar no-print" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.path} href={`#/${n.path}`} aria-current={active === n.path ? 'page' : undefined}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
