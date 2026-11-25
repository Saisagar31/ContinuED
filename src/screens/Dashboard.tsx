import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../app/context';
import { Empty, ErrorBox, Loading, Notice, SkillLabel } from '../app/ui';
import { LANG_NAMES } from '../content/i18n';
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
  const { uiLang, online } = useApp();
  const source = useMemo(() => fixtureSource({ failWhenOffline: true, latencyMs: 250 }), []);
  const [q, setQ] = useState<AggregateQuery>({ fromMonth: '2026-01', toMonth: '2026-11' });
  const [state, setState] = useState<{ data?: AggregateResponse; cached?: boolean; loading: boolean; error?: string }>({ loading: true });

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    source.query(q).then(
      (data) => {
        writeCache(q, data);
        if (live) setState({ data, loading: false });
      },
      (e: Error) => {
        const cached = readCache(q);
        if (live) setState({ data: cached ?? undefined, cached: !!cached, loading: false, error: e.message });
      },
    );
    return () => {
      live = false;
    };
  }, [q, source, online]);

  const set = (patch: Partial<AggregateQuery>) => setQ({ ...q, ...patch });
  const d = state.data;
  const th = d?.suppressionThreshold ?? 5;

  return (
    <div className="stack">
      <h1>Transfer and learning trends</h1>
      <Notice kind="warn">
        Synthetic data. The real view reads the school sync API (task 11), which enforces who may see which schools.
      </Notice>

      <section className="card filters">
        <label>
          From
          <select value={q.fromMonth} onChange={(e) => set({ fromMonth: e.target.value, toMonth: e.target.value > q.toMonth ? e.target.value : q.toMonth })}>
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>
          To
          <select value={q.toMonth} onChange={(e) => set({ toMonth: e.target.value, fromMonth: e.target.value < q.fromMonth ? e.target.value : q.fromMonth })}>
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>
          District
          <select value={q.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })}>
            <option value="">All</option>
            {SYNTHETIC_DISTRICTS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label>
          Origin language
          <select value={q.originLang ?? ''} onChange={(e) => set({ originLang: (e.target.value || undefined) as LangCode | undefined })}>
            <option value="">All</option>
            {ALL_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l].native}</option>)}
          </select>
        </label>
      </section>

      {state.loading && !d && <Loading label="Loading trends…" />}
      {!d && !state.loading && state.error && (
        <ErrorBox title="Trends are unavailable offline">No saved copy for these filters yet. Connect once to load them; they will then open offline.</ErrorBox>
      )}

      {d && (
        <>
          <div className={`asof ${state.cached ? 'stale' : ''}`} role="status">
            {state.cached ? 'Offline — saved copy. ' : ''}Data as of {new Date(d.asOf).toLocaleString()} · {d.coverage.schoolsReporting} of {d.coverage.schoolsTotal} schools reporting
            {state.loading && ' · refreshing…'}
          </div>
          {d.totalTransfers === 0 ? (
            <Empty title="No transfers in this period">Widen the date range or clear the filters.</Empty>
          ) : (
            <>
              <section className="card stat">
                <div className="stat-num">{fmtCount(d.totalTransfers, th)}</div>
                <div className="muted">transfers received</div>
              </section>
              <section className="card">
                <h2>Language corridors</h2>
                <Bars threshold={th} rows={d.corridors.map((c) => ({ key: `${c.from}-${c.to}`, count: c.count, label: <><span lang={c.from}>{LANG_NAMES[c.from].native}</span> → <span lang={c.to}>{LANG_NAMES[c.to].native}</span></> }))} />
              </section>
              <section className="card">
                <h2>Skills needing support at arrival</h2>
                <Bars threshold={th} rows={d.skills.map((s) => ({ key: s.skillId, count: s.count, label: <SkillLabel id={s.skillId} lang={uiLang} /> }))} />
              </section>
              <section className="card">
                <h2>By month</h2>
                <Bars threshold={th} rows={d.byMonth.map((m) => ({ key: m.month, count: m.count, label: m.month }))} />
              </section>
              <p className="small muted">Groups smaller than {th} are shown as “&lt;{th}” to protect individual learners (placeholder rule pending school approval).</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
