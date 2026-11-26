import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createCognitoClient } from '../auth/cognito';
import { createStaffSession, type SessionState, type StaffSession } from '../auth/session';
import type { LangCode } from '../domain/types';
import type { Workspace } from '../store/db';
import { getSyncStatus, onSyncStatus, pending, type SyncStatus } from '../sync/outbox';
import { AUTH_CONFIG, syncNow, webFetch } from './services';

interface AppState {
  ws: Workspace | null;
  setWs(ws: Workspace | null): void;
  uiLang: LangCode;
  setUiLang(l: LangCode): void;
  online: boolean;
  /** School sign-in for the open teacher profile; null when this build has no school services. */
  staff: StaffSession | null;
  staffState: SessionState;
  sync: SyncStatus;
  /** Events still on this phone (not yet acknowledged by the school). */
  pendingCount: number;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [uiLang, setUiLangState] = useState<LangCode>(() => {
    try {
      return (localStorage.getItem('continued.uiLang') as LangCode) || 'en';
    } catch {
      return 'en';
    }
  });
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  // One staff session per open teacher profile; switching teacher drops in-memory tokens.
  const [staff, setStaff] = useState<StaffSession | null>(null);
  const [staffState, setStaffState] = useState<SessionState>({ status: 'signed_out' });
  useEffect(() => {
    if (!ws || !AUTH_CONFIG) {
      setStaff(null);
      setStaffState({ status: 'signed_out' });
      return;
    }
    const s = createStaffSession({
      teacherId: ws.teacherId,
      client: createCognitoClient({ region: AUTH_CONFIG.region, clientId: AUTH_CONFIG.clientId, fetch: webFetch }),
      apiUrl: AUTH_CONFIG.apiUrl,
      fetch: webFetch,
    });
    const off = s.onChange(setStaffState);
    void s.load().then(setStaffState);
    setStaff(s);
    return () => {
      off();
      s.dispose();
    };
  }, [ws?.teacherId]);

  // Sync status, pending count, and a sync attempt whenever the phone comes online or the teacher signs in.
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    const refresh = () => void pending().then((p) => setPendingCount(p.filter((e) => !e.rejectedReason).length), () => undefined);
    refresh();
    return onSyncStatus((st) => {
      setSync(st);
      refresh();
    });
  }, []);
  useEffect(() => {
    if (online && staffState.status === 'signed_in') void syncNow(staff);
  }, [online, staffState.status, staff]);

  const setUiLang = (l: LangCode) => {
    setUiLangState(l);
    try {
      localStorage.setItem('continued.uiLang', l);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ ws, setWs, uiLang, setUiLang, online, staff, staffState, sync, pendingCount }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

export function useWs() {
  const { ws } = useApp();
  if (!ws) throw new Error('Not signed in');
  return ws;
}

// ---------- tiny hash router ----------

export function useRoute(): string[] {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export const go = (path: string) => {
  location.hash = path.startsWith('#') ? path : `#${path}`;
};

/** Load async data and expose reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: Error | undefined; loading: boolean; reload(): void } {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (error) => live && setState({ error, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data: state.data, error: state.error, loading: state.loading, reload: () => setTick((t) => t + 1) };
}
