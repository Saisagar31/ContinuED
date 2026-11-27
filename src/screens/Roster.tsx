import { useState, type FormEvent } from 'react';
import { go, useApp, useAsync, useWs } from '../app/context';
import { Empty, ErrorBox, Loading, fmtDate } from '../app/ui';
import { t } from '../content/i18n';
import { AGE_BANDS, type AgeBand } from '../domain/types';
import { HeroCluster } from '../illustrations/HeroCluster';
import { ChunkyButton } from '../ui/ChunkyButton';
import { LangStrip } from '../ui/LangStrip';

export function Roster() {
  const ws = useWs();
  const { uiLang: L } = useApp();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const data = useAsync(async () => {
    const [learners, sessions] = await Promise.all([ws.learners(), ws.sessions()]);
    return { learners, sessions };
  }, [ws.teacherId]);

  if (data.loading && !data.data) return <Loading label={t(L, 'common.loading')} />;
  if (data.error) return <ErrorBox title={t(L, 'roster.storageError')}>{data.error.message}</ErrorBox>;
  const { learners, sessions } = data.data!;
  const drafts = sessions.filter((s) => s.status === 'draft');
  const needle = q.trim().toUpperCase();
  const shown = learners.filter((l) => !needle || l.id.includes(needle) || (l.label ?? '').toUpperCase().includes(needle));

  return (
    <div className="stack roster-screen">
      <section className="passport-hero" aria-labelledby="passport-hero-title">
        <HeroCluster />
        <div className="passport-hero-copy">
          <p className="passport-eyebrow">{t(L, 'roster.title')}</p>
          <h1 id="passport-hero-title">{t(L, 'signin.tagline')}</h1>
          <div className="passport-hero-actions">
            <ChunkyButton onClick={() => setAdding(true)}>{t(L, 'roster.add')}</ChunkyButton>
            <ChunkyButton ghost onClick={() => go('/receive')}>{t(L, 'nav.receive')}</ChunkyButton>
          </div>
        </div>
      </section>
      <LangStrip />

      {adding && <AddLearner onDone={(id) => { setAdding(false); if (id) go(`/learner/${id}`); else data.reload(); }} />}

      {drafts.length > 0 && (
        <section className="card">
          <h2>{t(L, 'roster.drafts')}</h2>
          <ul className="list">
            {drafts.map((d) => {
              const l = learners.find((x) => x.id === d.learnerId);
              return (
                <li key={d.id}>
                  <a href={`#/assess/${d.id}`} className="list-link">
                    <span><strong className="mono">{d.learnerId}</strong> {l?.label && <span className="muted">· {l.label}</span>}</span>
                    <span className="muted">{t(L, 'roster.answered', { n: d.attempts.length })} · {fmtDate(d.updatedAt)} · {t(L, 'roster.resume')}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <label className="search">
        <span className="sr-only">{t(L, 'roster.find')}</span>
        <input type="search" placeholder={t(L, 'roster.find')} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {learners.length === 0 ? (
        <Empty title={t(L, 'roster.empty')}>{t(L, 'roster.emptyHint')}</Empty>
      ) : shown.length === 0 ? (
        <Empty title={t(L, 'roster.noMatch', { q })} />
      ) : (
        <ul className="list card">
          {shown.map((l) => {
            const ls = sessions.filter((s) => s.learnerId === l.id);
            const done = ls.filter((s) => s.status === 'completed').length;
            return (
              <li key={l.id}>
                <a href={`#/learner/${l.id}`} className="list-link">
                  <span>
                    <strong className="mono">{l.id}</strong>
                    {l.label && <span className="muted"> · {l.label}</span>}
                    {l.source === 'transfer' && <span className="tag">{t(L, 'roster.transferredIn')}</span>}
                  </span>
                  <span className="muted">{l.ageBand ? `${t(L, 'common.age', { age: l.ageBand })} · ` : ''}{t(L, 'roster.assessments', { n: done })}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddLearner({ onDone }: { onDone(id?: string): void }) {
  const ws = useWs();
  const { uiLang: L } = useApp();
  const [label, setLabel] = useState('');
  const [age, setAge] = useState<AgeBand | ''>('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const l = await ws.addLearner({ label, ageBand: age || undefined });
    onDone(l.id);
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{t(L, 'add.title')}</h2>
      <p className="muted small">{t(L, 'add.hint')}</p>
      <label>
        {t(L, 'add.nickname')}
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
      </label>
      <label>
        {t(L, 'add.ageBand')}
        <select value={age} onChange={(e) => setAge(e.target.value as AgeBand)}>
          <option value="">{t(L, 'add.notRecorded')}</option>
          {AGE_BANDS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="primary">{t(L, 'add.submit')}</button>
        <button type="button" onClick={() => onDone()}>{t(L, 'common.cancel')}</button>
      </div>
    </form>
  );
}
