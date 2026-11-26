import { useEffect, useRef, useState } from 'react';
import { go, useApp, useWs } from '../app/context';
import { ErrorBox, Loading, Notice, SkillLabel } from '../app/ui';
import { LANG_NAMES, contentReviewed, skillName, t, type MsgKey } from '../content/i18n';
import { exposedItemIds, nextItem, reasonText, whyStopped, type StopReason } from '../assess/engine';
import type { Observation, PresentedItem, Session, SkillStatus } from '../domain/types';
import type { Workspace } from '../store/db';
import { activePack } from '../audio/packManager';
import { availabilityFor, playFor, type Availability } from '../audio/player';
import type { LangCode } from '../domain/types';

const OBS_BUTTONS: { obs: Observation; label: MsgKey; hint: MsgKey }[] = [
  { obs: 'independent', label: 'obs.independent', hint: 'obs.independentHint' },
  { obs: 'prompted', label: 'obs.prompted', hint: 'obs.promptedHint' },
  { obs: 'incorrect', label: 'obs.incorrect', hint: 'obs.incorrectHint' },
  { obs: 'skipped', label: 'obs.skipped', hint: 'obs.skippedHint' },
];

/** Approved clip IDs in the installed pack for `lang`, so the engine can prefer recorded items. */
async function clipCheck(lang: LangCode): Promise<((id: string) => boolean) | undefined> {
  const m = await activePack(lang);
  if (!m) return undefined;
  const ok = new Set(m.clips.filter((c) => c.reviewStatus === 'approved').map((c) => c.contentId));
  return (id) => ok.has(id);
}

async function context(ws: Workspace, s: Session) {
  const others = (await ws.sessions(s.learnerId)).filter((x) => x.id !== s.id);
  const seen = exposedItemIds(others);
  const prev = s.predecessorId ? others.find((x) => x.id === s.predecessorId) : undefined;
  const prior: Record<string, SkillStatus> = prev?.confirmed ?? {};
  return { seen, prior };
}

export function Assess({ sessionId }: { sessionId: string }) {
  const ws = useWs();
  const { uiLang: L } = useApp();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [stopped, setStopped] = useState<StopReason | null>(null);
  /** Teacher chose to reuse questions from earlier sessions once unseen ones ran out. */
  const [allowRepeats, setAllowRepeats] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const presenting = useRef(false);

  /** Next item, or the reason the session stops. */
  async function decide(s: Session, repeats: boolean, alternative = false): Promise<PresentedItem | undefined> {
    const { seen, prior } = await context(ws, s);
    const across = repeats ? new Set<string>() : seen;
    const item = nextItem(s, across, prior, alternative, { hasClip: await clipCheck(s.assessmentLang) });
    if (!item && !alternative) setStopped(whyStopped(s, across, prior));
    return item;
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await ws.session(sessionId);
      if (!live) return;
      if (!s) return setSession(null);
      if (s.status === 'completed') return go(`/transfer/${s.id}`);
      if (!s.current && !presenting.current) {
        presenting.current = true;
        const item = await decide(s, false);
        if (!item) return setSession(s);
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
      const next = await decide(after, allowRepeats);
      setSession(await ws.commitAttempt(session.id, attempt, next));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function alternative() {
    if (!session || !item || busy) return;
    setBusy(true);
    try {
      const alt = await decide(session, allowRepeats, true);
      if (!alt) return setError(t(L, 'assess.noAlt'));
      setSession(await ws.replaceCurrent(session.id, alt));
    } finally {
      setBusy(false);
    }
  }

  async function useEarlierQuestions() {
    if (!session || busy) return;
    setBusy(true);
    try {
      setAllowRepeats(true);
      const next = await decide(session, true);
      if (next) {
        setStopped(null);
        setSession(await ws.present(session.id, next));
      }
    } finally {
      setBusy(false);
    }
  }

  const answered = session.attempts.length > 0;

  return (
    <div className="stack assess">
      <div className="row between">
        <a href={`#/learner/${session.learnerId}`} className="back">{t(L, 'assess.pause')}</a>
        <span className="muted small">
          <span className="mono">{session.learnerId}</span> · {LANG_NAMES[session.assessmentLang].native} · {t(L, 'assess.answered', { n: session.attempts.length })}
        </span>
      </div>

      {!contentReviewed(session.assessmentLang) && (
        <Notice kind="warn">{t(L, 'assess.draftLang', { lang: LANG_NAMES[session.assessmentLang].native })}</Notice>
      )}

      {item ? (
        <>
          <section className="card question" aria-live="polite">
            <div className="muted small"><SkillLabel id={item.skillId} lang={L} /> · {t(L, 'assess.level', { n: item.band })}</div>
            <div className="small muted">{t(L, 'assess.say')}</div>
            <p className="prompt" lang={session.assessmentLang}>{item.prompt}</p>
            {item.audio && item.audio !== 'none' && <PlayInstruction lang={session.assessmentLang} contentId={item.audioContentId ?? item.itemId} text={item.prompt} />}
            {item.stimulus && (
              <>
                <div className="small muted">{t(L, 'assess.show')}</div>
                <p className="stimulus big" lang={session.assessmentLang}>{item.stimulus}</p>
                {item.skillId.startsWith('lit.') && <p className="small">{t(L, 'assess.noAudioStimulus')}</p>}
              </>
            )}
            <details>
              <summary>{t(L, 'assess.expected')}</summary>
              <p className="mono" lang={session.assessmentLang}>{item.expected}</p>
            </details>
            <p className="small muted">{t(L, 'assess.why', { reason: reasonText(L, item.selectionReason) })}</p>
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
            {answered && <button onClick={() => go(`/review/${session.id}`)}>{t(L, 'assess.finish')}</button>}
          </div>
        </>
      ) : (
        <section className="card stack">
          <StopMessage reason={stopped} answered={answered} />
          {stopped?.kind === 'exhausted' && !allowRepeats && (
            <button onClick={useEarlierQuestions} disabled={busy}>{t(L, 'assess.allowRepeats')}</button>
          )}
          {answered && <button className="primary" onClick={() => go(`/review/${session.id}`)}>{t(L, 'assess.review')}</button>}
        </section>
      )}
    </div>
  );
}

function StopMessage({ reason, answered }: { reason: StopReason | null; answered: boolean }) {
  const { uiLang: L } = useApp();
  if (reason?.kind === 'version_mismatch') return <p>{t(L, 'assess.versionMismatch', { cv: reason.sessionVersion, mine: reason.installedVersion })}</p>;
  if (reason?.kind === 'all_mastered') return <p>{t(L, 'assess.allMastered')}</p>;
  if (reason?.kind === 'exhausted')
    return (
      <>
        <h2>{answered ? t(L, 'assess.ready') : t(L, 'assess.none')}</h2>
        <p>{t(L, 'assess.exhausted', { skills: reason.skills.map((s) => skillName(L, s)).join(', ') })}</p>
      </>
    );
  return (
    <>
      <h2>{answered ? t(L, 'assess.ready') : t(L, 'assess.none')}</h2>
      <p>{answered ? t(L, 'assess.readyHint') : t(L, 'assess.noneHint')}</p>
    </>
  );
}

/** Plays a reviewed clip or device speech, with a visible text-only state. */
function PlayInstruction({ lang, contentId, text }: { lang: LangCode; contentId: string; text: string }) {
  const { uiLang: L } = useApp();
  const [avail, setAvail] = useState<Availability | null>(null);
  useEffect(() => {
    let live = true;
    setAvail(null);
    void availabilityFor(lang, contentId).then((a) => live && setAvail(a));
    return () => {
      live = false;
    };
  }, [lang, contentId]);
  if (avail === null) return null;
  if (avail === 'text_only') return <p className="small muted">{t(L, 'oral.noPack', { lang: LANG_NAMES[lang].native })}</p>;
  return (
    <button className="small" onClick={() => void playFor(lang, contentId, text).then(setAvail)}>
      {t(L, 'assess.play')}
      {avail === 'device_speech' ? ` · ${t(L, 'oral.deviceSpeech')}` : ''}
    </button>
  );
}
