import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useApp, useAsync, useWs } from '../app/context';
import { ErrorBox, Loading, Notice, SkillLabel, StatusPill, fmtDate, localDate } from '../app/ui';
import { LANG_NAMES, t } from '../content/i18n';
import { summarise } from '../assess/engine';
import { encodeCapsule, type TransferEnvelope } from '../transfer/capsule';
import { deviceTrustStore } from '../transfer/deviceTrust';
import { currentIssuerKid, serverSigner } from '../transfer/serverSigner';
import { API_URL, record, transferIssuedEvent, webFetch } from '../app/services';

export function TransferSlip({ sessionId }: { sessionId: string }) {
  const ws = useWs();
  const { uiLang: L, online, staff, staffState } = useApp();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState('');

  const data = useAsync(async () => {
    const s = await ws.session(sessionId);
    if (!s || s.status !== 'completed') return null;
    const learner = await ws.learner(s.learnerId);
    const env: TransferEnvelope = {
      v: 1,
      tid: 'T' + s.id.slice(1), // stable per session, so reprints match
      lp: s.learnerId,
      ...(learner?.ageBand ? { age: learner.ageBand } : {}),
      ol: s.assessmentLang,
      ad: localDate(s.completedAt ?? s.updatedAt), // the teacher's calendar day, not UTC
      cv: s.contentVersion,
      s: summarise(s),
    };
    // School-verified issuance when online and signed in; otherwise (or if signing fails) the
    // unsigned slip, which the receiving phone labels "issuer unverified" (plan section 3, "Issuer trust").
    let signed: 'yes' | 'no' | 'failed' = 'no';
    let code: string | undefined;
    const kid = API_URL && staff && online && staffState.status === 'signed_in' ? currentIssuerKid(deviceTrustStore()) : undefined;
    if (kid && API_URL && staff) {
      try {
        code = await encodeCapsule(env, serverSigner({ apiUrl: API_URL, kid, getToken: staff.getToken, fetch: webFetch }));
        signed = 'yes';
      } catch {
        signed = 'failed';
      }
    }
    code ??= await encodeCapsule(env);
    void record(transferIssuedEvent(env.tid, env.lp, env.ol, env.cv, env.s), staff);
    return { env, code, signed };
  }, [sessionId, staffState.status]);

  useEffect(() => {
    if (!data.data || !canvas.current) return;
    QRCode.toCanvas(canvas.current, data.data.code, { errorCorrectionLevel: 'M', margin: 2, width: 280 }).catch((e: Error) => setQrError(e.message));
  }, [data.data]);

  if (data.loading && !data.data) return <Loading label={t(L, 'slip.building')} />;
  if (data.error) return <ErrorBox title={t(L, 'slip.errBuild')}>{data.error.message}</ErrorBox>;
  if (!data.data) return <ErrorBox title={t(L, 'slip.notCompleted')}><a href={`#/assess/${sessionId}`}>{t(L, 'slip.resume')}</a></ErrorBox>;
  const { env, code, signed } = data.data;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is selectable below */
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'ContinuED', text: code });
    } catch {
      /* cancelled */
    }
  }

  const langLabel = `${LANG_NAMES[env.ol].native} (${LANG_NAMES[env.ol].english})`;

  return (
    <div className="stack slip">
      <a href={`#/learner/${env.lp}`} className="back no-print">{t(L, 'slip.back')}</a>
      <h1>{t(L, 'slip.title')}</h1>
      <div className="card stack print-card">
        <div className="slip-head">
          <div>
            <div className="mono big">{env.lp}</div>
            <div className="small">
              {t(L, 'slip.assessed', { date: fmtDate(env.ad), lang: langLabel })}
              {env.age ? ` · ${t(L, 'common.age', { age: env.age })}` : ''} · {t(L, 'slip.content', { v: env.cv })}
            </div>
            {signed === 'yes' ? (
              <div className="trust trust-verified">{t(L, 'slip.signed')}</div>
            ) : (
              <div className="trust trust-unverified">{t(L, 'slip.unverified')}</div>
            )}
            {signed === 'failed' && <p className="small no-print">{t(L, 'slip.signFailed')}</p>}
          </div>
        </div>
        <div className="qr-wrap">
          <canvas ref={canvas} aria-label={t(L, 'slip.qr')} role="img" />
          {qrError && <ErrorBox title={t(L, 'slip.qrError')}>{qrError}</ErrorBox>}
        </div>
        <ul className="list compact">
          {env.s.map((x) => (
            <li key={x.skillId} className="row between">
              <SkillLabel id={x.skillId} lang={L} />
              <StatusPill status={x.status} lang={L} />
            </li>
          ))}
        </ul>
        <details className="code-box" open>
          <summary>{t(L, 'slip.textCode', { n: code.length })}</summary>
          <code className="mono wrap" aria-label={t(L, 'slip.textCode', { n: code.length })}>{code}</code>
        </details>
        <p className="small muted print-only">{t(L, 'slip.howTo')}</p>
      </div>
      <div className="row no-print">
        <button className="primary" onClick={() => window.print()}>{t(L, 'slip.print')}</button>
        <button onClick={copy}>{copied ? t(L, 'slip.copied') : t(L, 'slip.copy')}</button>
        {'share' in navigator && <button onClick={share}>{t(L, 'slip.share')}</button>}
      </div>
      <Notice kind="warn">{t(L, 'slip.warn')}</Notice>
    </div>
  );
}
