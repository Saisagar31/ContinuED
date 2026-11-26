import { useState } from 'react';
import { go, useApp, useAsync, useWs } from '../app/context';
import { Empty, ErrorBox, Loading, SkillLabel, StatusPill, fmtDate } from '../app/ui';
import { CONTENT_VERSION, orderedSkills } from '../content/skills';
import { LANG_NAMES, t } from '../content/i18n';
import { LANGS, type LangCode, type Session } from '../domain/types';
import { summarise } from '../assess/stubEngine';

export function LearnerDetail({ id }: { id: string }) {
  const ws = useWs();
  const { uiLang: L } = useApp();
  const [assessLang, setAssessLang] = useState<LangCode>(L);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const data = useAsync(async () => ({ learner: await ws.learner(id), sessions: await ws.sessions(id) }), [id, ws.teacherId]);

  if (data.loading && !data.data) return <Loading label={t(L, 'common.loading')} />;
  const learner = data.data?.learner;
  if (!learner) return <ErrorBox title={t(L, 'learner.notFound')}>{t(L, 'learner.notFoundHint')} <a href="#/">{t(L, 'learner.back')}</a></ErrorBox>;
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
      <a href="#/" className="back">{t(L, 'learner.back')}</a>
      <div>
        <h1 className="mono">{learner.id}</h1>
        <p className="muted">
          {learner.label ? `${learner.label} · ` : ''}
          {learner.ageBand ? `${t(L, 'common.age', { age: learner.ageBand })} · ` : ''}
          {t(L, 'learner.added', { date: fmtDate(learner.createdAt) })}
          {learner.source === 'transfer' ? ` · ${t(L, 'roster.transferredIn')}` : ''}
        </p>
      </div>

      <section className="card stack">
        {draft ? (
          <>
            <h2>{t(L, 'learner.inProgress')}</h2>
            <p className="muted">{t(L, 'assess.answered', { n: draft.attempts.length })} · {LANG_NAMES[draft.assessmentLang].native}</p>
            <a className="button primary" href={`#/assess/${draft.id}`}>{t(L, 'learner.resume')}</a>
          </>
        ) : (
          <>
            <h2>{completed.length ? t(L, 'learner.reassessTitle') : t(L, 'learner.startTitle')}</h2>
            <label>
              {t(L, 'learner.assessLang')}
              <select value={assessLang} onChange={(e) => setAssessLang(e.target.value as LangCode)}>
                {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l].native} — {LANG_NAMES[l].english}</option>)}
              </select>
            </label>
            <p className="small muted">{t(L, 'learner.assessLangHint')}</p>
            <button className="primary" onClick={start}>{completed.length ? t(L, 'learner.reassess') : t(L, 'learner.start')}</button>
          </>
        )}
      </section>

      {completed.length >= 2 && <Progress latest={completed[0]} previous={completed[1]} lang={L} />}

      <section className="card">
        <h2>{t(L, 'learner.history')}</h2>
        {completed.length === 0 ? (
          <Empty title={t(L, 'learner.noHistory')} />
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
                    <span key={x.skillId} className="pill-line"><SkillLabel id={x.skillId} lang={L} /> <StatusPill status={x.status} lang={L} /></span>
                  ))}
                </div>
                <div className="row">
                  <a className="button" href={`#/transfer/${s.id}`}>{t(L, 'learner.slip')}</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack danger-zone">
        <h2>{t(L, 'learner.delete')}</h2>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}>{t(L, 'learner.deleteAsk')}</button>
        ) : (
          <>
            <p>{t(L, 'learner.deleteWarn', { id: learner.id, n: sessions.length })}</p>
            <div className="row">
              <button className="danger" onClick={remove}>{t(L, 'learner.deleteConfirm')}</button>
              <button onClick={() => setConfirmDelete(false)}>{t(L, 'common.cancel')}</button>
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
      <h2>{t(lang, 'learner.progress', { date: fmtDate(previous.completedAt) })}</h2>
      <table className="table">
        <thead><tr><th>{t(lang, 'learner.skill')}</th><th>{t(lang, 'learner.before')}</th><th>{t(lang, 'learner.now')}</th></tr></thead>
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
