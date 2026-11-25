import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useApp, useAsync, useWs } from '../app/context';
import { ErrorBox, Loading, Notice, SkillLabel, StatusPill, fmtDate, localDate } from '../app/ui';
import { LANG_NAMES } from '../content/i18n';
import { summarise } from '../assess/stubEngine';
import { encodeCapsule, type TransferEnvelope } from '../transfer/capsule';

export function TransferSlip({ sessionId }: { sessionId: string }) {
  const ws = useWs();
  const { uiLang } = useApp();
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
    return { env, code: await encodeCapsule(env) };
  }, [sessionId]);

  useEffect(() => {
    if (!data.data || !canvas.current) return;
    QRCode.toCanvas(canvas.current, data.data.code, { errorCorrectionLevel: 'M', margin: 2, width: 280 }).catch((e: Error) => setQrError(e.message));
  }, [data.data]);

  if (data.loading && !data.data) return <Loading label="Building transfer…" />;
  if (data.error) return <ErrorBox title="Could not build the transfer">{data.error.message}</ErrorBox>;
  if (!data.data) return <ErrorBox title="This assessment is not completed yet"><a href={`#/assess/${sessionId}`}>Resume it</a></ErrorBox>;
  const { env, code } = data.data;

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
      await navigator.share({ title: 'ContinuED transfer', text: code });
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="stack slip">
      <a href={`#/learner/${env.lp}`} className="back no-print">← Learner</a>
      <h1>Transfer slip</h1>
      <div className="card stack print-card">
        <div className="slip-head">
          <div>
            <div className="mono big">{env.lp}</div>
            <div className="small">
              Assessed {fmtDate(env.ad)} in <span lang={env.ol}>{LANG_NAMES[env.ol].native}</span> ({LANG_NAMES[env.ol].english})
              {env.age ? ` · age ${env.age}` : ''} · content {env.cv}
            </div>
            <div className="trust trust-unverified">Issuer: unverified — created on this phone</div>
          </div>
        </div>
        <div className="qr-wrap">
          <canvas ref={canvas} aria-label="Transfer QR code" role="img" />
          {qrError && <ErrorBox title="QR could not be drawn">{qrError}. Use the text code below.</ErrorBox>}
        </div>
        <ul className="list compact">
          {env.s.map((x) => (
            <li key={x.skillId} className="row between">
              <SkillLabel id={x.skillId} lang={uiLang} />
              <StatusPill status={x.status} lang={uiLang} />
            </li>
          ))}
        </ul>
        <details className="code-box" open>
          <summary>Text code ({code.length} characters)</summary>
          <code className="mono wrap" aria-label="Transfer text code">{code}</code>
        </details>
        <p className="small muted print-only">Scan with ContinuED, or type the text code under “Receive → Paste code”.</p>
      </div>
      <div className="row no-print">
        <button className="primary" onClick={() => window.print()}>Print slip</button>
        <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy code'}</button>
        {'share' in navigator && <button onClick={share}>Share…</button>}
      </div>
      <Notice kind="warn">
        Anyone holding this slip or code can read the learner summary. Give it only to the receiving school. School-verified
        signing is added when the school service is ready (task 11).
      </Notice>
    </div>
  );
}
