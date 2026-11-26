import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../app/context';
import { Empty, ErrorBox, Loading, Notice, SkillLabel } from '../app/ui';
import { LANG_NAMES, t } from '../content/i18n';
import {
  ALL_LANGS,
  SYNTHETIC_DISTRICTS,
  fixtureSource,
  readCache,
  writeCache,
  type AggregateQuery,
  type AggregateResponse,
  type Count,
} from '../dashboard/aggregates';
import type { LangCode } from '../domain/types';
import { API_URL, webFetch } from '../app/services';
import { ApiError, apiAggregateSource } from '../sync/apiAggregateSource';

const MONTHS = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);

function fmtCount(c: Count, threshold: number) {
  return c === null ? `<${threshold}` : c.toLocaleString();
}

function Bars({ rows, threshold }: { rows: { key: string; label: ReactNode; count: Count }[]; threshold: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count ?? 0));
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="bar-label">{r.label}</div>
          <div className="bar-track" aria-hidden="true">
            <div className={`bar-fill ${r.count === null ? 'suppressed' : ''}`} style={{ width: r.count === null ? '100%' : `${(100 * r.count) / max}%` }} />
          </div>
          <div className="bar-value">{fmtCount(r.count, threshold)}</div>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard() {
  const { uiLang: L, online, staff, staffState } = useApp();
  // The school API when signed in (it decides which schools this person may see); practice data otherwise.
  const live = !!(API_URL && staff && staffState.status === 'signed_in');
  const source = useMemo(
    () => (live && API_URL && staff ? apiAggregateSource({ apiUrl: API_URL, getToken: staff.getToken, fetch: webFetch }) : fixtureSource({ failWhenOffline: true, latencyMs: 250 })),
    [live, staff],
  );
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const cacheScope = live && staff ? `school:${staff.teacherId}` : 'practice';
  const [q, setQ] = useState<AggregateQuery>({ fromMonth: '2026-01', toMonth: '2026-11' });
  const [state, setState] = useState<{ data?: AggregateResponse; cached?: boolean; loading: boolean; error?: string }>({ loading: true });

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    source.query(q).then(
      (data) => {
        writeCache(q, data, cacheScope);
        if (live) setState({ data, loading: false });
      },
      (e: Error) => {
        if (e instanceof ApiError && e.status === 401) setNeedsSignIn(true);
        const cached = readCache(q, cacheScope);
        if (live) setState({ data: cached ?? undefined, cached: !!cached, loading: false, error: e.message });
      },
    );
    return () => {
      live = false;
    };
  }, [q, source, online, cacheScope]);

  const set = (patch: Partial<AggregateQuery>) => setQ({ ...q, ...patch });
  const d = state.data;
  const th = d?.suppressionThreshold ?? 5;

  return (
    <div className="stack">
      <h1>{t(L, 'dash.title')}</h1>
      {!live && <Notice kind="warn">{t(L, 'dash.synthetic')}</Notice>}
      {API_URL && (!live || needsSignIn) && <Notice><a href="#/school">{t(L, 'dash.signIn')}</a></Notice>}

      <section className="card filters">
        <label>
          {t(L, 'dash.from')}
          <select value={q.fromMonth} onChange={(e) => set({ fromMonth: e.target.value, toMonth: e.target.value > q.toMonth ? e.target.value : q.toMonth })}>
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>
          {t(L, 'dash.to')}
          <select value={q.toMonth} onChange={(e) => set({ toMonth: e.target.value, fromMonth: e.target.value < q.fromMonth ? e.target.value : q.fromMonth })}>
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>
          {t(L, 'dash.district')}
          <select value={q.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })}>
            <option value="">{t(L, 'dash.all')}</option>
            {SYNTHETIC_DISTRICTS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label>
          {t(L, 'dash.originLang')}
          <select value={q.originLang ?? ''} onChange={(e) => set({ originLang: (e.target.value || undefined) as LangCode | undefined })}>
            <option value="">{t(L, 'dash.all')}</option>
            {ALL_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l].native}</option>)}
          </select>
        </label>
      </section>

      {state.loading && !d && <Loading label={t(L, 'dash.loading')} />}
      {!d && !state.loading && state.error && <ErrorBox title={t(L, 'dash.unavailable')}>{t(L, 'dash.unavailableHint')}</ErrorBox>}

      {d && (
        <>
          <div className={`asof ${state.cached ? 'stale' : ''}`} role="status">
            {state.cached ? `${t(L, 'dash.savedCopy')} ` : ''}
            {t(L, 'dash.asOf', { time: new Date(d.asOf).toLocaleString(), r: d.coverage.schoolsReporting, t: d.coverage.schoolsTotal })}
            {state.loading && ` · ${t(L, 'dash.refreshing')}`}
          </div>
          {d.totalTransfers === 0 ? (
            <Empty title={t(L, 'dash.noTransfers')}>{t(L, 'dash.noTransfersHint')}</Empty>
          ) : (
            <>
              <section className="card stat">
                <div className="stat-num">{fmtCount(d.totalTransfers, th)}</div>
                <div className="muted">{t(L, 'dash.received')}</div>
              </section>
              <section className="card">
                <h2>{t(L, 'dash.corridors')}</h2>
                <Bars threshold={th} rows={d.corridors.map((c) => ({ key: `${c.from}-${c.to}`, count: c.count, label: <><span lang={c.from}>{LANG_NAMES[c.from].native}</span> → <span lang={c.to}>{LANG_NAMES[c.to].native}</span></> }))} />
              </section>
              <section className="card">
                <h2>{t(L, 'dash.skills')}</h2>
                <Bars threshold={th} rows={d.skills.map((s) => ({ key: s.skillId, count: s.count, label: <SkillLabel id={s.skillId} lang={L} /> }))} />
              </section>
              <section className="card">
                <h2>{t(L, 'dash.byMonth')}</h2>
                <Bars threshold={th} rows={d.byMonth.map((m) => ({ key: m.month, count: m.count, label: m.month }))} />
              </section>
              <p className="small muted">{t(L, 'dash.suppressed', { n: th })}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
