import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { go, useApp, useAsync, useWs } from '../app/context';
import { ErrorBox, Notice, fmtDate } from '../app/ui';
import { t, type MsgKey } from '../content/i18n';
import { decodeCapsule, type DecodeResult } from '../transfer/capsule';
import { deviceTrustStore } from '../transfer/deviceTrust';
import { record, transferReceivedEvent } from '../app/services';

type Mode = 'scan' | 'upload' | 'paste';

const FAILURES: Record<string, { title: MsgKey; fix: MsgKey }> = {
  malformed: { title: 'receive.malformed', fix: 'receive.malformedFix' },
  wrong_version: { title: 'receive.wrong_version', fix: 'receive.wrong_versionFix' },
  damaged: { title: 'receive.damaged', fix: 'receive.damagedFix' },
};

const MODE_LABEL: Record<Mode, MsgKey> = { scan: 'receive.scan', upload: 'receive.photo', paste: 'receive.paste' };

export function Receive() {
  const ws = useWs();
  const { uiLang: L, staff } = useApp();
  const [mode, setMode] = useState<Mode>('scan');
  const [failure, setFailure] = useState<Extract<DecodeResult, { ok: false }> | null>(null);
  const received = useAsync(() => ws.transfers(), [ws.teacherId]);

  const handle = useCallback(
    async (text: string) => {
      setFailure(null);
      const r = await decodeCapsule(text, deviceTrustStore());
      if (!r.ok) return setFailure(r);
      await ws.saveTransfer({ tid: r.envelope.tid, code: r.code, trust: r.trust });
      // Destination language = the receiving teacher's interface language (the corridor end on the dashboard).
      const e = r.envelope;
      void record(transferReceivedEvent(e.tid, ws.teacherId, e.lp, e.ol, L, e.cv, e.s), staff);
      go(`/plan/${r.envelope.tid}`);
    },
    [ws, L, staff],
  );

  return (
    <div className="stack">
      <h1>{t(L, 'receive.title')}</h1>
      <div className="seg tabs" role="tablist">
        {(['scan', 'upload', 'paste'] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setFailure(null); }}>
            {t(L, MODE_LABEL[m])}
          </button>
        ))}
      </div>

      {mode === 'scan' && <Scanner onCode={handle} onFallback={setMode} />}
      {mode === 'upload' && <Upload onCode={handle} />}
      {mode === 'paste' && <Paste onCode={handle} />}

      {failure && (
        <ErrorBox title={t(L, FAILURES[failure.reason].title)}>
          <p>{t(L, FAILURES[failure.reason].fix)}</p>
          <p className="small muted">{t(L, 'common.detail', { detail: failure.detail })}</p>
        </ErrorBox>
      )}

      {(received.data?.length ?? 0) > 0 && (
        <section className="card">
          <h2>{t(L, 'receive.list')}</h2>
          <ul className="list">
            {received.data!.map((tr) => (
              <li key={tr.tid}>
                <a className="list-link" href={`#/plan/${tr.tid}`}>
                  <span className="mono">{tr.tid}</span>
                  <span className="muted small">{fmtDate(tr.receivedAt)} · {t(L, `trust.${tr.trust}`)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Notice>{t(L, 'receive.offlineNote')}</Notice>
    </div>
  );
}

function decodeImageData(img: ImageData): string | null {
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

function Scanner({ onCode, onFallback }: { onCode(t: string): void; onFallback(m: Mode): void }) {
  const { uiLang: L } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'denied' | 'nocamera' | 'insecure' | 'error'>('idle');
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number>(0);
  const done = useRef(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }, []);

  // Always release the camera when leaving the screen or switching tab.
  useEffect(() => {
    const onHide = () => document.hidden && (stop(), setState('idle'));
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      stop();
    };
  }, [stop]);

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setState('insecure');
    setState('starting');
    done.current = false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setState('running');
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      const tick = () => {
        if (done.current || !stream.current) return;
        if (v.readyState >= 2 && v.videoWidth) {
          const scale = Math.min(1, 640 / v.videoWidth);
          c.width = v.videoWidth * scale;
          c.height = v.videoHeight * scale;
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const text = decodeImageData(ctx.getImageData(0, 0, c.width, c.height));
          if (text) {
            done.current = true;
            stop();
            setState('idle');
            navigator.vibrate?.(60);
            onCode(text);
            return;
          }
        }
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      stop();
      const name = (e as DOMException).name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'error');
    }
  }

  return (
    <section className="card stack">
      <div className={`viewfinder ${state === 'running' ? 'live' : ''}`}>
        <video ref={video} playsInline muted aria-label={t(L, 'cam.preview')} />
        {state !== 'running' && <div className="vf-placeholder">{t(L, 'cam.off')}</div>}
      </div>
      {state === 'running' ? (
        <button onClick={() => { stop(); setState('idle'); }}>{t(L, 'cam.cancel')}</button>
      ) : (
        <button className="primary" onClick={start} disabled={state === 'starting'}>{state === 'starting' ? t(L, 'cam.starting') : t(L, 'cam.start')}</button>
      )}
      {state === 'denied' && (
        <ErrorBox title={t(L, 'cam.denied')}>
          {t(L, 'cam.deniedHint')}{' '}
          <button className="link" onClick={() => onFallback('upload')}>{t(L, 'receive.photo')}</button> /{' '}
          <button className="link" onClick={() => onFallback('paste')}>{t(L, 'receive.paste')}</button>
        </ErrorBox>
      )}
      {state === 'nocamera' && <ErrorBox title={t(L, 'cam.none')}>{t(L, 'cam.noneHint')}</ErrorBox>}
      {state === 'insecure' && <ErrorBox title={t(L, 'cam.insecure')}>{t(L, 'cam.insecureHint')}</ErrorBox>}
      {state === 'error' && <ErrorBox title={t(L, 'cam.error')}>{t(L, 'cam.errorHint')}</ErrorBox>}
    </section>
  );
}

function Upload({ onCode }: { onCode(t: string): void }) {
  const { uiLang: L } = useApp();
  const [err, setErr] = useState('');
  async function onFile(f?: File) {
    setErr('');
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      // Try a few scales: large photos decode better downscaled; small crops better as-is.
      for (const max of [1200, 800, 1800]) {
        const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * scale);
        c.height = Math.round(bmp.height * scale);
        const ctx = c.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        const text = decodeImageData(ctx.getImageData(0, 0, c.width, c.height));
        if (text) return onCode(text);
      }
      setErr(t(L, 'upload.noQr'));
    } catch {
      setErr(t(L, 'upload.badFile'));
    }
  }
  return (
    <section className="card stack">
      <label className="file">
        {t(L, 'upload.choose')}
        <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {err && <ErrorBox title={err} />}
    </section>
  );
}

function Paste({ onCode }: { onCode(t: string): void }) {
  const { uiLang: L } = useApp();
  const [text, setText] = useState('');
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); onCode(text); }}>
      <label>
        {t(L, 'paste.label')}
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" className="mono" />
      </label>
      <button className="primary" disabled={!text.trim()}>{t(L, 'paste.open')}</button>
    </form>
  );
}
