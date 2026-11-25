import { useState, type FormEvent } from 'react';
import { go, useAsync, useWs } from '../app/context';
import { Empty, ErrorBox, Loading, fmtDate } from '../app/ui';
import { AGE_BANDS, type AgeBand } from '../domain/types';

export function Roster() {
  const ws = useWs();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const data = useAsync(async () => {
    const [learners, sessions] = await Promise.all([ws.learners(), ws.sessions()]);
    return { learners, sessions };
  }, [ws.teacherId]);

  if (data.loading && !data.data) return <Loading />;
  if (data.error) return <ErrorBox title="Could not open this phone’s storage">{data.error.message} — close other ContinuED tabs and reopen.</ErrorBox>;
  const { learners, sessions } = data.data!;
  const drafts = sessions.filter((s) => s.status === 'draft');
  const needle = q.trim().toUpperCase();
  const shown = learners.filter((l) => !needle || l.id.includes(needle) || (l.label ?? '').toUpperCase().includes(needle));

  return (
    <div className="stack">
      <div className="row between">
        <h1>My learners</h1>
        <button className="primary" onClick={() => setAdding(true)}>+ Learner</button>
      </div>

      {adding && <AddLearner onDone={(id) => { setAdding(false); if (id) go(`/learner/${id}`); else data.reload(); }} />}

      {drafts.length > 0 && (
        <section className="card">
          <h2>Unfinished assessments</h2>
          <ul className="list">
            {drafts.map((d) => {
              const l = learners.find((x) => x.id === d.learnerId);
              return (
                <li key={d.id}>
                  <a href={`#/assess/${d.id}`} className="list-link">
                    <span><strong className="mono">{d.learnerId}</strong> {l?.label && <span className="muted">· {l.label}</span>}</span>
                    <span className="muted">{d.attempts.length} answered · {fmtDate(d.updatedAt)} · Resume →</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <label className="search">
        <span className="sr-only">Find a learner</span>
        <input type="search" placeholder="Find by ID or nickname" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {learners.length === 0 ? (
        <Empty title="No learners yet">Add a learner to start an assessment, or receive a transfer from another school.</Empty>
      ) : shown.length === 0 ? (
        <Empty title={`No learner matches “${q}”`} />
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
                    {l.source === 'transfer' && <span className="tag">transferred in</span>}
                  </span>
                  <span className="muted">{l.ageBand ? `Age ${l.ageBand} · ` : ''}{done} assessment{done === 1 ? '' : 's'}</span>
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
  const [label, setLabel] = useState('');
  const [age, setAge] = useState<AgeBand | ''>('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const l = await ws.addLearner({ label, ageBand: age || undefined });
    onDone(l.id);
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Add learner</h2>
      <p className="muted small">A random pseudonymous ID is created. The nickname stays on this phone and is never included in a transfer.</p>
      <label>
        Nickname (optional, this phone only)
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
      </label>
      <label>
        Age band
        <select value={age} onChange={(e) => setAge(e.target.value as AgeBand)}>
          <option value="">Not recorded</option>
          {AGE_BANDS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="primary">Add</button>
        <button type="button" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}
