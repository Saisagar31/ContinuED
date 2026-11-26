import { useEffect, useRef, useState } from 'react';
import { go, useApp, useWs } from '../app/context';
import { ErrorBox, Loading, SkillLabel } from '../app/ui';
import { LANG_NAMES, t, type MsgKey } from '../content/i18n';
import { nextItem } from '../assess/stubEngine';
import type { Observation, Session, SkillStatus } from '../domain/types';
import type { Workspace } from '../store/db';

const OBS_BUTTONS: { obs: Observation; label: MsgKey; hint: MsgKey }[] = [
  { obs: 'independent', label: 'obs.independent', hint: 'obs.independentHint' },
  { obs: 'prompted', label: 'obs.prompted', hint: 'obs.promptedHint' },
  { obs: 'incorrect', label: 'obs.incorrect', hint: 'obs.incorrectHint' },
  { obs: 'skipped', label: 'obs.skipped', hint: 'obs.skippedHint' },
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
  const { uiLang: L } = useApp();
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

  if (error) return <ErrorBox title={t(L, 'assess.errContinue')}>{error}</ErrorBox>;
  if (session === undefined) return <Loading label={t(L, 'assess.restoring')} />;
  if (session === null) return <ErrorBox title={t(L, 'assess.notFound')}>{t(L, 'assess.notFoundHint')} <a href="#/">{t(L, 'learner.back')}</a></ErrorBox>;

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
    if (!alt) return setError(t(L, 'assess.noAlt'));
    setSession(await ws.present(session.id, alt));
  }

  return (
    <div className="stack assess">
      <div className="row between">
        <a href={`#/learner/${session.learnerId}`} className="back">{t(L, 'assess.pause')}</a>
        <span className="muted small">
          <span className="mono">{session.learnerId}</span> · {LANG_NAMES[session.assessmentLang].native} · {t(L, 'assess.answered', { n: session.attempts.length })}
        </span>
      </div>

      {item && !exhausted ? (
        <>
          <section className="card question" aria-live="polite">
            <div className="muted small"><SkillLabel id={item.skillId} lang={L} /> · {t(L, 'assess.level', { n: item.band })}</div>
            <p className="prompt" lang={session.assessmentLang}>{item.prompt}</p>
            <details>
              <summary>{t(L, 'assess.expected')}</summary>
              <p className="mono" lang={session.assessmentLang}>{item.expected}</p>
            </details>
            <p className="small muted">{t(L, 'assess.why', { reason: item.selectionReason })}</p>
          </section>
          <div className="obs-grid" role="group" aria-label={t(L, 'assess.record')}>
            {OBS_BUTTONS.map((b) => (
              <button key={b.obs} className={`obs obs-${b.obs}`} disabled={busy} onClick={() => answer(b.obs)}>
                <strong>{t(L, b.label)}</strong>
                <span className="small">{t(L, b.hint)}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <button onClick={alternative} disabled={busy}>{t(L, 'assess.different')}</button>
            {session.attempts.length > 0 && <button onClick={() => go(`/review/${session.id}`)}>{t(L, 'assess.finish')}</button>}
          </div>
        </>
      ) : (
        <section className="card stack">
          <h2>{session.attempts.length ? t(L, 'assess.ready') : t(L, 'assess.none')}</h2>
          <p>{session.attempts.length ? t(L, 'assess.readyHint') : t(L, 'assess.noneHint')}</p>
          {session.attempts.length > 0 && <button className="primary" onClick={() => go(`/review/${session.id}`)}>{t(L, 'assess.review')}</button>}
        </section>
      )}
    </div>
  );
}
