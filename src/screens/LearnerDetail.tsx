import { useState } from 'react';
import { go, useApp, useAsync, useWs } from '../app/context';
import { Empty, ErrorBox, Loading, SkillLabel, StatusPill, fmtDate } from '../app/ui';
import { CONTENT_VERSION, orderedSkills } from '../content/skills';
import { LANG_NAMES } from '../content/i18n';
import { LANGS, type LangCode, type Session } from '../domain/types';
import { summarise } from '../assess/stubEngine';

export function LearnerDetail({ id }: { id: string }) {
  const ws = useWs();
  const { uiLang } = useApp();
  const [assessLang, setAssessLang] = useState<LangCode>(uiLang);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const data = useAsync(async () => ({ learner: await ws.learner(id), sessions: await ws.sessions(id) }), [id, ws.teacherId]);

  if (data.loading && !data.data) return <Loading />;
  const learner = data.data?.learner;
  if (!learner) return <ErrorBox title="Learner not found in your workspace">They may belong to another teacher on this phone, or were deleted. <a href="#/">Back to learners</a></ErrorBox>;
  const sessions = data.data!.sessions;
  const completed = sessions.filter((s) => s.status === 'completed');
  const draft = sessions.find((s) => s.status === 'draft');

  async function start() {
    const s = await ws.startSession(id, { assessmentLang: assessLang, contentVersion: CONTENT_VERSION });
    go(`/assess/${s.id}`);
  }

  async function remove() {
    await ws.deleteLearner(id);
    go('/');
  }

  return (
    <div className="stack">
      <a href="#/" className="back">← Learners</a>
      <div>
        <h1 className="mono">{learner.id}</h1>
        <p className="muted">
          {learner.label ? `${learner.label} · ` : ''}
          {learner.ageBand ? `Age ${learner.ageBand} · ` : ''}
          added {fmtDate(learner.createdAt)}
          {learner.source === 'transfer' ? ' · transferred in' : ''}
        </p>
      </div>

      <section className="card stack">
        {draft ? (
          <>
            <h2>Assessment in progress</h2>
            <p className="muted">{draft.attempts.length} answered · in {LANG_NAMES[draft.assessmentLang].native}</p>
            <a className="button primary" href={`#/assess/${draft.id}`}>Resume assessment</a>
          </>
        ) : (
          <>
            <h2>{completed.length ? 'Reassess' : 'Start assessment'}</h2>
            <label>
              Learner’s strongest language (assessment language)
              <select value={assessLang} onChange={(e) => setAssessLang(e.target.value as LangCode)}>
                {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l].native} — {LANG_NAMES[l].english}</option>)}
              </select>
            </label>
            <p className="small muted">This is independent of the interface language you read the app in.</p>
            <button className="primary" onClick={start}>{completed.length ? 'Start reassessment' : 'Start assessment'}</button>
          </>
        )}
      </section>

      {completed.length >= 2 && <Progress latest={completed[0]} previous={completed[1]} lang={uiLang} />}

      <section className="card">
        <h2>History</h2>
        {completed.length === 0 ? (
          <Empty title="No completed assessments yet" />
        ) : (
          <ul className="list">
            {completed.map((s) => (
              <li key={s.id} className="history-item">
                <div className="row between">
                  <strong>{fmtDate(s.completedAt)}</strong>
                  <span className="muted small">{LANG_NAMES[s.assessmentLang].native} · v{s.contentVersion}</span>
                </div>
                <div className="pills">
                  {summarise(s).map((x) => (
                    <span key={x.skillId} className="pill-line"><SkillLabel id={x.skillId} lang={uiLang} /> <StatusPill status={x.status} lang={uiLang} /></span>
                  ))}
                </div>
                <div className="row">
                  <a className="button" href={`#/transfer/${s.id}`}>Transfer slip</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack danger-zone">
        <h2>Delete learner</h2>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}>Delete from this phone…</button>
        ) : (
          <>
            <p>This permanently removes <strong className="mono">{learner.id}</strong> and {sessions.length} assessment record{sessions.length === 1 ? '' : 's'} from this phone. It cannot be undone. Transfer slips already given out are not affected.</p>
            <div className="row">
              <button className="danger" onClick={remove}>Delete permanently</button>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Progress({ latest, previous, lang }: { latest: Session; previous: Session; lang: LangCode }) {
  const now = Object.fromEntries(summarise(latest).map((x) => [x.skillId, x.status]));
  const before = Object.fromEntries(summarise(previous).map((x) => [x.skillId, x.status]));
  const rows = orderedSkills().filter((s) => now[s.id] || before[s.id]);
  return (
    <section className="card">
      <h2>Progress since {fmtDate(previous.completedAt)}</h2>
      <table className="table">
        <thead><tr><th>Skill</th><th>Before</th><th>Now</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td><SkillLabel id={s.id} lang={lang} /></td>
              <td>{before[s.id] ? <StatusPill status={before[s.id]} lang={lang} /> : '—'}</td>
              <td>{now[s.id] ? <StatusPill status={now[s.id]} lang={lang} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
