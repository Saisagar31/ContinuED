import { useState } from 'react';
import { go, useApp, useAsync, useWs } from '../app/context';
import { Empty, ErrorBox, Loading, Notice, SkillLabel, StatusPill, fmtDate } from '../app/ui';
import { LANG_NAMES, t } from '../content/i18n';
import { CONTENT_VERSION, SKILL_BY_ID } from '../content/skills';
import { buildPlan } from '../plan/plan';
import { decodeCapsule } from '../transfer/capsule';
import { deviceTrustStore } from '../transfer/deviceTrust';
import type { LangCode, TrustState } from '../domain/types';

const TRUST_LABEL: Record<TrustState, string> = {
  verified: 'Verified by issuing school',
  unverified: 'Issuer unverified — created offline on a teacher’s phone',
  unknown_key: 'Signed by a school this phone does not know yet — treat as unverified',
  expired_key: 'Signed with an expired school key — treat as unverified',
  revoked_key: 'Signed with a withdrawn school key — do not rely on it',
  altered: 'Signature does not match — this record was changed after signing',
};

export function PlanScreen({ tid }: { tid: string }) {
  const ws = useWs();
  const { uiLang } = useApp();
  const [added, setAdded] = useState(false);
  const data = useAsync(async () => {
    const rec = (await ws.transfers()).find((x) => x.tid === tid);
    if (!rec) return null;
    const r = await decodeCapsule(rec.code, deviceTrustStore());
    if (!r.ok) return { rec, error: r.detail } as const;
    const inRoster = !!(await ws.learner(r.envelope.lp));
    return { rec, r, inRoster } as const;
  }, [tid, ws.teacherId]);

  if (data.loading && !data.data) return <Loading />;
  if (!data.data) return <ErrorBox title="Transfer not found on this phone"><a href="#/receive">Receive it again</a></ErrorBox>;
  if ('error' in data.data) return <ErrorBox title="Stored transfer could not be read">{data.data.error}</ErrorBox>;
  const { r, inRoster } = data.data;
  const env = r.envelope;
  const plan = buildPlan(env.s);
  const L = uiLang;

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
      <a href="#/receive" className="back no-print">← Receive</a>
      <div className={`trust trust-${r.trust}`} role="status">{TRUST_LABEL[r.trust]}{r.issuer ? ` · ${r.issuer}` : ''}</div>

      <section className="card stack">
        <div className="mono big">{env.lp}</div>
        <div className="small">
          {t(L, 'plan.assessedIn')} <strong lang={env.ol}>{LANG_NAMES[env.ol].native}</strong> ({LANG_NAMES[env.ol].english}) · {fmtDate(env.ad)}
          {env.age ? ` · age ${env.age}` : ''}
        </div>
        {env.cv !== CONTENT_VERSION && (
          <Notice kind="warn">Assessed with content version {env.cv}; this phone has {CONTENT_VERSION}. Skill IDs are stable, but check activities match your materials.</Notice>
        )}
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
                  (independent {plan.because.evidence.independent}, prompted {plan.because.evidence.prompted}, incorrect {plan.because.evidence.incorrect}, skipped {plan.because.evidence.skipped})
                </>
              ) : (
                'no direct evidence for this skill'
              )}
              {plan.chain.length > 1 && (
                <div className="muted">
                  Builds towards: {plan.chain.slice(1).map((id, i) => <span key={id}>{i ? ' → ' : ''}<SkillLabel id={id} lang={L} /></span>)}
                </div>
              )}
            </div>
            {plan.mode === 'check' && <p className="small">There is no evidence for this prerequisite yet. Check it quickly before teaching the target skill.</p>}
          </section>

          <section className="card stack">
            <h3>{t(L, 'plan.activities')}</h3>
            {plan.skill.activities.map((a) => (
              <div key={a.id} className="activity">
                <strong>{a.title}</strong> <span className="muted small">· {a.minutes} min</span>
                <p>{a.steps}</p>
              </div>
            ))}
            <h3>{t(L, 'plan.group')}</h3>
            <p>{plan.skill.peerGroup}</p>
          </section>

          <OralCheck lang={env.ol} text={plan.skill.oralCheck} />
        </>
      )}

      <div className="row no-print">
        <button onClick={() => window.print()}>Print plan</button>
        {inRoster || added ? <a className="button" href={`#/learner/${env.lp}`}>Open in my learners</a> : <button className="primary" onClick={addToRoster}>Add to my learners</button>}
      </div>
      <details className="no-print">
        <summary className="small">Remove this transfer from the phone</summary>
        <button className="danger" onClick={remove}>Remove transfer</button>
      </details>
    </div>
  );
}

function OralCheck({ lang, text }: { lang: LangCode; text: string }) {
  const { uiLang } = useApp();
  const hasOriginText = lang === 'en'; // reviewed origin-language scripts arrive with task 09
  const voice = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)) : undefined;
  return (
    <section className="card stack">
      <h3>{t(uiLang, 'plan.oral')} · <span lang={lang}>{LANG_NAMES[lang].native}</span></h3>
      <p>{text}</p>
      <div className="audio-state small">
        <span className="tag">Audio: no reviewed {LANG_NAMES[lang].english} pack installed</span>
        {!hasOriginText && <span className="tag">{LANG_NAMES[lang].english} script pending review</span>}
      </div>
      {hasOriginText && voice && (
        <button
          onClick={() => {
            const u = new SpeechSynthesisUtterance(text);
            u.voice = voice;
            u.lang = voice.lang;
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
          }}
        >
          ▶ Play with device voice (not reviewed)
        </button>
      )}
      <p className="small muted">Read the check aloud yourself, or ask a colleague who speaks {LANG_NAMES[lang].english}. Reviewed ElevenLabs audio arrives with the language packs (task 10).</p>
    </section>
  );
}
