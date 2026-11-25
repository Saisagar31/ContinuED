import { useState } from 'react';
import { go, useApp, useAsync, useWs } from '../app/context';
import { ErrorBox, Loading, SkillLabel, StatusPill } from '../app/ui';
import { t } from '../content/i18n';
import { orderedSkills } from '../content/skills';
import { evidenceFor, suggestStatus } from '../assess/stubEngine';
import { STATUSES, type SkillStatus } from '../domain/types';

export function Review({ sessionId }: { sessionId: string }) {
  const ws = useWs();
  const { uiLang } = useApp();
  const s = useAsync(() => ws.session(sessionId), [sessionId]);
  const [picked, setPicked] = useState<Record<string, SkillStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  if (s.loading && !s.data) return <Loading />;
  const session = s.data;
  if (!session) return <ErrorBox title="Assessment not found" />;
  if (session.status === 'completed') {
    go(`/transfer/${session.id}`);
    return null;
  }

  const skills = orderedSkills().filter((sk) => session.attempts.some((a) => a.skillId === sk.id));
  const rows = skills.map((sk) => {
    const ev = evidenceFor(session.attempts, sk.id);
    return { sk, ev, suggested: suggestStatus(ev) };
  });
  const missing = rows.filter((r) => !picked[r.sk.id]);
  const overridesMissingReason = rows.filter((r) => picked[r.sk.id] && picked[r.sk.id] !== r.suggested && !reasons[r.sk.id]?.trim());

  async function confirm() {
    if (missing.length) return setError('Confirm a status for every skill.');
    if (overridesMissingReason.length) return setError('Give a reason where you changed the suggested status.');
    const overrides: Record<string, { from: SkillStatus; reason: string }> = {};
    for (const r of rows) if (picked[r.sk.id] !== r.suggested) overrides[r.sk.id] = { from: r.suggested, reason: reasons[r.sk.id].trim() };
    await ws.complete(session!.id, picked, overrides);
    go(`/transfer/${session!.id}`);
  }

  return (
    <div className="stack">
      <a href={`#/assess/${session.id}`} className="back">← Back to questions</a>
      <h1>Confirm results</h1>
      <p className="muted">Check each skill against the rubric. A suggestion is only a starting point — nothing is saved as mastered until you confirm it.</p>
      {rows.map(({ sk, ev, suggested }) => (
        <fieldset key={sk.id} className="card stack">
          <legend><SkillLabel id={sk.id} lang={uiLang} /></legend>
          <div className="small muted">
            Independent {ev.independent} · Prompted {ev.prompted} · Incorrect {ev.incorrect} · Skipped {ev.skipped}
          </div>
          <div className="small">Suggested: <StatusPill status={suggested} lang={uiLang} /></div>
          <div className="seg" role="radiogroup" aria-label={`Status for ${sk.name}`}>
            {STATUSES.map((st) => (
              <label key={st} className={picked[sk.id] === st ? 'on' : ''}>
                <input type="radio" name={sk.id} checked={picked[sk.id] === st} onChange={() => setPicked({ ...picked, [sk.id]: st })} />
                {t(uiLang, `status.${st}`)}
              </label>
            ))}
          </div>
          {picked[sk.id] && picked[sk.id] !== suggested && (
            <label>
              Reason for changing the suggestion
              <input value={reasons[sk.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [sk.id]: e.target.value })} />
            </label>
          )}
        </fieldset>
      ))}
      {error && <ErrorBox title={error} />}
      <button className="primary" onClick={confirm}>Confirm and create transfer slip</button>
    </div>
  );
}
