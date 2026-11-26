import { useState } from 'react';
import { go, useApp, useAsync, useWs } from '../app/context';
import { Empty, ErrorBox, Loading, Notice, SkillLabel, StatusPill, fmtDate } from '../app/ui';
import { LANG_NAMES, packState, t } from '../content/i18n';
import { skillText } from '../content/packs';
import { CONTENT_VERSION, SKILL_BY_ID } from '../content/skills';
import { buildPlan } from '../plan/plan';
import { decodeCapsule } from '../transfer/capsule';
import { deviceTrustStore } from '../transfer/deviceTrust';
import type { LangCode } from '../domain/types';

export function PlanScreen({ tid }: { tid: string }) {
  const ws = useWs();
  const { uiLang: L } = useApp();
  const [added, setAdded] = useState(false);
  const data = useAsync(async () => {
    const rec = (await ws.transfers()).find((x) => x.tid === tid);
    if (!rec) return null;
    const r = await decodeCapsule(rec.code, deviceTrustStore());
    if (!r.ok) return { rec, error: r.detail } as const;
    const inRoster = !!(await ws.learner(r.envelope.lp));
    return { rec, r, inRoster } as const;
  }, [tid, ws.teacherId]);

  if (data.loading && !data.data) return <Loading label={t(L, 'common.loading')} />;
  if (!data.data) return <ErrorBox title={t(L, 'plan.notFound')}><a href="#/receive">{t(L, 'plan.receiveAgain')}</a></ErrorBox>;
  if ('error' in data.data) return <ErrorBox title={t(L, 'plan.unreadable')}>{data.data.error}</ErrorBox>;
  const { r, inRoster } = data.data;
  const env = r.envelope;
  const plan = buildPlan(env.s);
  // Activities and peer groups are shown in the interface language; the oral check in the origin language.
  const text = plan.kind === 'next' ? skillText(L, plan.skill.id) : undefined;

  async function addToRoster() {
    await ws.addLearner({ id: env.lp, ageBand: env.age, source: 'transfer' });
    setAdded(true);
  }

  async function remove() {
    await ws.deleteTransfer(tid);
    go('/receive');
  }

  return (
    <div className="stack">
      <a href="#/receive" className="back no-print">{t(L, 'plan.back')}</a>
      <div className={`trust trust-${r.trust}`} role="status">{t(L, `trust.${r.trust}`)}{r.issuer ? ` · ${r.issuer}` : ''}</div>

      <section className="card stack">
        <div className="mono big">{env.lp}</div>
        <div className="small">
          {t(L, 'plan.assessedIn')} <strong lang={env.ol}>{LANG_NAMES[env.ol].native}</strong> ({LANG_NAMES[env.ol].english}) · {fmtDate(env.ad)}
          {env.age ? ` · ${t(L, 'common.age', { age: env.age })}` : ''}
        </div>
        {env.cv !== CONTENT_VERSION && <Notice kind="warn">{t(L, 'plan.versionWarn', { cv: env.cv, mine: CONTENT_VERSION })}</Notice>}
        <ul className="list compact">
          {env.s.map((x) => (
            <li key={x.skillId} className="row between">
              <span>{SKILL_BY_ID[x.skillId] ? <SkillLabel id={x.skillId} lang={L} /> : <span className="mono">{x.skillId}</span>}</span>
              <StatusPill status={x.status} lang={L} />
            </li>
          ))}
        </ul>
      </section>

      {plan.kind === 'empty' && <Empty title={t(L, 'plan.empty')} />}
      {plan.kind === 'all_mastered' && <Empty title={t(L, 'plan.allMastered')} />}
      {plan.kind === 'insufficient' && <Empty title={t(L, 'plan.insufficient')} />}
      {plan.kind === 'next' && (
        <>
          <section className="card stack plan">
            <div className="muted small">{plan.mode === 'check' ? t(L, 'plan.check') : t(L, 'plan.next')}</div>
            <h2><SkillLabel id={plan.skill.id} lang={L} /></h2>
            <div className="small">
              <strong>{t(L, 'plan.because')}:</strong>{' '}
              {plan.because ? (
                <>
                  <SkillLabel id={plan.because.skillId} lang={L} /> — <StatusPill status={plan.because.status} lang={L} />{' '}
                  ({t(L, 'review.evidence', { i: plan.because.evidence.independent, p: plan.because.evidence.prompted, x: plan.because.evidence.incorrect, s: plan.because.evidence.skipped })})
                </>
              ) : (
                t(L, 'plan.noEvidence')
              )}
              {plan.chain.length > 1 && (
                <div className="muted">
                  {t(L, 'plan.buildsTowards')}: {plan.chain.slice(1).map((id, i) => <span key={id}>{i ? ' → ' : ''}<SkillLabel id={id} lang={L} /></span>)}
                </div>
              )}
            </div>
            {plan.mode === 'check' && <p className="small">{t(L, 'plan.checkFirst')}</p>}
          </section>

          <section className="card stack">
            <h3>{t(L, 'plan.activities')}</h3>
            {plan.skill.activities.map((a, i) => (
              <div key={a.id} className="activity" lang={L}>
                <strong>{text?.activities[i]?.title ?? a.title}</strong> <span className="muted small">· {t(L, 'plan.minutes', { n: a.minutes })}</span>
                <p>{text?.activities[i]?.steps ?? a.steps}</p>
              </div>
            ))}
            <h3>{t(L, 'plan.group')}</h3>
            <p lang={L}>{text?.group ?? plan.skill.peerGroup}</p>
          </section>

          <OralCheck lang={env.ol} skillId={plan.skill.id} />
        </>
      )}

      <div className="row no-print">
        <button onClick={() => window.print()}>{t(L, 'plan.print')}</button>
        {inRoster || added ? <a className="button" href={`#/learner/${env.lp}`}>{t(L, 'plan.openLearner')}</a> : <button className="primary" onClick={addToRoster}>{t(L, 'plan.addLearner')}</button>}
      </div>
      <details className="no-print">
        <summary className="small">{t(L, 'plan.removeAsk')}</summary>
        <button className="danger" onClick={remove}>{t(L, 'plan.remove')}</button>
      </details>
    </div>
  );
}

/** The oral check in the learner's origin language, so the receiving teacher can run it even without speaking that language. */
function OralCheck({ lang, skillId }: { lang: LangCode; skillId: string }) {
  const { uiLang } = useApp();
  const text = skillText(lang, skillId)?.oral ?? SKILL_BY_ID[skillId]?.oralCheck ?? '';
  const translation = uiLang !== lang ? skillText(uiLang, skillId)?.oral : undefined;
  const name = LANG_NAMES[lang].english;
  const voice = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)) : undefined;
  return (
    <section className="card stack">
      <h3>{t(uiLang, 'plan.oral')} · <span lang={lang}>{LANG_NAMES[lang].native}</span></h3>
      <p lang={lang} className="prompt">{text}</p>
      {translation && <p className="small muted" lang={uiLang}>{translation}</p>}
      <div className="audio-state small">
        <span className="tag">{t(uiLang, 'oral.noPack', { lang: name })}</span>
        {packState(lang) !== 'complete' && <span className="tag">{t(uiLang, 'oral.draft', { lang: name })}</span>}
      </div>
      {voice && (
        <button
          onClick={() => {
            const u = new SpeechSynthesisUtterance(text);
            u.voice = voice;
            u.lang = voice.lang;
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
          }}
        >
          {t(uiLang, 'oral.play')}
        </button>
      )}
      <p className="small muted">{t(uiLang, 'oral.readYourself', { lang: name })}</p>
    </section>
  );
}
