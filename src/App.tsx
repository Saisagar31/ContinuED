import { useEffect, useRef } from 'react';
import { go, useApp, useRoute } from './app/context';
import { LangSelect } from './app/LangSelect';
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

const NAV: { path: string; label: MsgKey; icon: string }[] = [
  { path: '', label: 'nav.learners', icon: '👥' },
  { path: 'receive', label: 'nav.receive', icon: '⇩' },
  { path: 'groups', label: 'nav.groups', icon: '◫' },
  { path: 'dashboard', label: 'nav.trends', icon: '▤' },
];

export function App() {
  const { ws, setWs, uiLang, online } = useApp();
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
    default: screen = <Roster />;
  }
  const active = NAV.find((n) => n.path === (head ?? ''))?.path ?? (head === 'plan' ? 'receive' : '');

  return (
    <div className="shell">
      <header className="topbar no-print">
        <a className="brand" href="#/">ContinuED</a>
        <LangSelect />
        <button className="link" onClick={() => { setWs(null); go('/'); }} aria-label={`${t(uiLang, 'app.switch')}: ${ws.displayName}`}>
          {ws.displayName} · {t(uiLang, 'app.switch')}
        </button>
      </header>
      {!online && <div className="offline-bar no-print" role="status">{t(uiLang, 'app.offline')}</div>}
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
