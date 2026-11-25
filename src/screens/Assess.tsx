import { useEffect, useRef, useState } from 'react';
import { go, useApp, useWs } from '../app/context';
import { ErrorBox, Loading, Notice, SkillLabel } from '../app/ui';
import { LANG_NAMES } from '../content/i18n';
import { nextItem } from '../assess/stubEngine';
import type { Observation, Session, SkillStatus } from '../domain/types';
import type { Workspace } from '../store/db';

const OBS_BUTTONS: { obs: Observation; label: string; hint: string }[] = [
  { obs: 'independent', label: 'Correct, on their own', hint: 'No help given' },
  { obs: 'prompted', label: 'Correct with a prompt', hint: 'You gave a hint or repeated' },
  { obs: 'incorrect', label: 'Incorrect', hint: 'Answer did not match' },
  { obs: 'skipped', label: 'Skipped / no answer', hint: 'Ability stays undecided' },
];

async function context(ws: Workspace, s: Session) {
  const others = (await ws.sessions(s.learnerId)).filter((x) => x.id !== s.id);
  const seen = new Set(others.flatMap((x) => x.attempts.map((a) => a.itemId)));
  const prev = s.predecessorId ? others.find((x) => x.id === s.predecessorId) : undefined;
  const prior: Record<string, SkillStatus> = prev?.confirmed ?? {};
  return { seen, prior };
}

export function Assess({ sessionId }: { sessionId: string }) {
  const ws = useWs();
  const { uiLang } = useApp();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [exhausted, setExhausted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const presenting = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await ws.session(sessionId);
      if (!live) return;
      if (!s) return setSession(null);
      if (s.status === 'completed') return go(`/transfer/${s.id}`);
      if (!s.current && !presenting.current) {
        presenting.current = true;
        const { seen, prior } = await context(ws, s);
        const item = nextItem(s, seen, prior);
        if (!item) {
          setExhausted(true);
          setSession(s);
          return;
        }
        // Persist BEFORE display so a restart resumes this exact question.
        const saved = await ws.present(s.id, item);
        if (live) setSession(saved);
        return;
      }
      setSession(s);
    })().catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, [sessionId, ws]);

  if (error) return <ErrorBox title="Could not continue the assessment">{error}</ErrorBox>;
  if (session === undefined) return <Loading label="Restoring assessment…" />;
  if (session === null) return <ErrorBox title="Assessment not found">It may belong to another teacher on this phone. <a href="#/">Back</a></ErrorBox>;

  const item = session.current;

  async function answer(obs: Observation) {
    if (!session || !item || busy) return;
    setBusy(true);
    try {
      const attempt = { ...item, observation: obs, answeredAt: new Date().toISOString() };
      const after = { ...session, attempts: [...session.attempts, attempt], current: undefined };
      const { seen, prior } = await context(ws, session);
      const next = nextItem(after, seen, prior);
      const saved = await ws.commitAttempt(session.id, attempt, next);
      setSession(saved);
      if (!next) setExhausted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function alternative() {
    if (!session || !item) return;
    const { seen, prior } = await context(ws, session);
    const alt = nextItem(session, seen, prior, true);
    if (!alt) return setError('No other eligible question for this skill and level in the installed content.');
    setSession(await ws.present(session.id, alt));
  }

  return (
    <div className="stack assess">
      <div className="row between">
        <a href={`#/learner/${session.learnerId}`} className="back">← Pause</a>
        <span className="muted small">
          <span className="mono">{session.learnerId}</span> · {LANG_NAMES[session.assessmentLang].native} · {session.attempts.length} answered
        </span>
      </div>

      {item && !exhausted ? (
        <>
          <section className="card question" aria-live="polite">
            <div className="muted small"><SkillLabel id={item.skillId} lang={uiLang} /> · level {item.band}</div>
            <p className="prompt" lang={session.assessmentLang}>{item.prompt}</p>
            <details>
              <summary>Expected answer</summary>
              <p className="mono">{item.expected}</p>
            </details>
            <p className="small muted">Why this question: {item.selectionReason}</p>
          </section>
          <div className="obs-grid" role="group" aria-label="Record the learner’s response">
            {OBS_BUTTONS.map((b) => (
              <button key={b.obs} className={`obs obs-${b.obs}`} disabled={busy} onClick={() => answer(b.obs)}>
                <strong>{b.label}</strong>
                <span className="small">{b.hint}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <button onClick={alternative} disabled={busy}>Different question</button>
            {session.attempts.length > 0 && <button onClick={() => go(`/review/${session.id}`)}>Finish & review</button>}
          </div>
        </>
      ) : (
        <section className="card stack">
          <h2>{session.attempts.length ? 'Ready to review' : 'No eligible questions'}</h2>
          <p>
            {session.attempts.length
              ? 'The session has enough items for the sample stopping rule, or the installed questions for the next step are used up.'
              : 'All installed questions for this learner have been seen before. You can review, change level, or stop.'}
          </p>
          {session.attempts.length > 0 && <button className="primary" onClick={() => go(`/review/${session.id}`)}>Review results</button>}
        </section>
      )}
      <Notice>
        Prototype question selection (stub). The evidence-based engine, stopping rules and reviewed content come from tasks
        04 and 06.
      </Notice>
    </div>
  );
}
