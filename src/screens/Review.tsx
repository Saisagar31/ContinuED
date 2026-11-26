import { useState } from 'react';
import { go, useApp, useAsync, useWs } from '../app/context';
import { ErrorBox, Loading, SkillLabel, StatusPill } from '../app/ui';
import { skillName, t } from '../content/i18n';
import { skillText } from '../content/packs';
import { orderedSkills } from '../content/skills';
import { evidenceFor, suggestStatusFor, summarise } from '../assess/engine';
import { assessmentCompletedEvent, record } from '../app/services';
import { STATUSES, type SkillStatus } from '../domain/types';

export function Review({ sessionId }: { sessionId: string }) {
  const ws = useWs();
  const { uiLang: L, staff } = useApp();
  const s = useAsync(() => ws.session(sessionId), [sessionId]);
  const [picked, setPicked] = useState<Record<string, SkillStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  if (s.loading && !s.data) return <Loading label={t(L, 'common.loading')} />;
  const session = s.data;
  if (!session) return <ErrorBox title={t(L, 'assess.notFound')} />;
  if (session.status === 'completed') {
    go(`/transfer/${session.id}`);
    return null;
  }

  const skills = orderedSkills().filter((sk) => session.attempts.some((a) => a.skillId === sk.id));
  const rows = skills.map((sk) => {
    const ev = evidenceFor(session.attempts, sk.id);
    return { sk, ev, suggested: suggestStatusFor(session.attempts, sk.id) };
  });
  const missing = rows.filter((r) => !picked[r.sk.id]);
  const overridesMissingReason = rows.filter((r) => picked[r.sk.id] && picked[r.sk.id] !== r.suggested && !reasons[r.sk.id]?.trim());

  async function confirm() {
    if (missing.length) return setError(t(L, 'review.errMissing'));
    if (overridesMissingReason.length) return setError(t(L, 'review.errReason'));
    const overrides: Record<string, { from: SkillStatus; reason: string }> = {};
    for (const r of rows) if (picked[r.sk.id] !== r.suggested) overrides[r.sk.id] = { from: r.suggested, reason: reasons[r.sk.id].trim() };
    const done = await ws.complete(session!.id, picked, overrides);
    void record(assessmentCompletedEvent(done, summarise(done)), staff);
    go(`/transfer/${session!.id}`);
  }

  return (
    <div className="stack">
      <a href={`#/assess/${session.id}`} className="back">{t(L, 'review.back')}</a>
      <h1>{t(L, 'review.title')}</h1>
      <p className="muted">{t(L, 'review.intro')}</p>
      {rows.map(({ sk, ev, suggested }) => {
        const rubric = skillText(L, sk.id)?.rubric;
        return (
          <fieldset key={sk.id} className="card stack">
            <legend><SkillLabel id={sk.id} lang={L} /></legend>
            <div className="small muted">
              {t(L, 'review.evidence', { i: ev.independent, p: ev.prompted, x: ev.incorrect, s: ev.skipped })}
            </div>
            <div className="small">{t(L, 'review.suggested')}: <StatusPill status={suggested} lang={L} /></div>
            {rubric && (
              <details className="small">
                <summary>{t(L, 'review.rubric')}</summary>
                <ul>
                  <li><strong>{t(L, 'status.mastered')}:</strong> {rubric.mastered}</li>
                  <li><strong>{t(L, 'status.developing')}:</strong> {rubric.developing}</li>
                  <li><strong>{t(L, 'status.not_yet')}:</strong> {rubric.not_yet}</li>
                </ul>
              </details>
            )}
            <div className="seg" role="radiogroup" aria-label={t(L, 'review.statusFor', { skill: skillName(L, sk.id) })}>
              {STATUSES.map((st) => (
                <label key={st} className={picked[sk.id] === st ? 'on' : ''}>
                  <input type="radio" name={sk.id} checked={picked[sk.id] === st} onChange={() => setPicked({ ...picked, [sk.id]: st })} />
                  {t(L, `status.${st}`)}
                </label>
              ))}
            </div>
            {picked[sk.id] && picked[sk.id] !== suggested && (
              <label>
                {t(L, 'review.reason')}
                <input value={reasons[sk.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [sk.id]: e.target.value })} />
              </label>
            )}
          </fieldset>
        );
      })}
      {error && <ErrorBox title={error} />}
      <button className="primary" onClick={confirm}>{t(L, 'review.confirm')}</button>
    </div>
  );
}
