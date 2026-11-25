import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { go, useAsync, useWs } from '../app/context';
import { ErrorBox, Notice, fmtDate } from '../app/ui';
import { decodeCapsule, type DecodeResult } from '../transfer/capsule';
import { deviceTrustStore } from '../transfer/deviceTrust';

type Mode = 'scan' | 'upload' | 'paste';

const FAILURES: Record<string, { title: string; fix: string }> = {
  malformed: { title: 'This is not a ContinuED transfer code', fix: 'Check you scanned the transfer QR (not another QR on the page), or paste the full text code.' },
  wrong_version: { title: 'This transfer was made by a different app version', fix: 'Update ContinuED on this phone when you are next online, then try again. Keep the slip.' },
  damaged: { title: 'The code is incomplete or has a typo', fix: 'Scan again in good light, or re-copy the whole text code. The last characters are a check that catches mistakes.' },
};

export function Receive() {
  const ws = useWs();
  const [mode, setMode] = useState<Mode>('scan');
  const [failure, setFailure] = useState<Extract<DecodeResult, { ok: false }> | null>(null);
  const received = useAsync(() => ws.transfers(), [ws.teacherId]);

  const handle = useCallback(
    async (text: string) => {
      setFailure(null);
      const r = await decodeCapsule(text, deviceTrustStore());
      if (!r.ok) return setFailure(r);
      await ws.saveTransfer({ tid: r.envelope.tid, code: r.code, trust: r.trust });
      go(`/plan/${r.envelope.tid}`);
    },
    [ws],
  );

  return (
    <div className="stack">
      <h1>Receive a transfer</h1>
      <div className="seg tabs" role="tablist">
        {(['scan', 'upload', 'paste'] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setFailure(null); }}>
            {m === 'scan' ? 'Scan QR' : m === 'upload' ? 'Photo of slip' : 'Paste code'}
          </button>
        ))}
      </div>

      {mode === 'scan' && <Scanner onCode={handle} onFallback={setMode} />}
      {mode === 'upload' && <Upload onCode={handle} />}
      {mode === 'paste' && <Paste onCode={handle} />}

      {failure && (
        <ErrorBox title={FAILURES[failure.reason].title}>
          <p>{FAILURES[failure.reason].fix}</p>
          <p className="small muted">Detail: {failure.detail}</p>
        </ErrorBox>
      )}

      {(received.data?.length ?? 0) > 0 && (
        <section className="card">
          <h2>Received on this phone</h2>
          <ul className="list">
            {received.data!.map((t) => (
              <li key={t.tid}>
                <a className="list-link" href={`#/plan/${t.tid}`}>
                  <span className="mono">{t.tid}</span>
                  <span className="muted small">{fmtDate(t.receivedAt)} · {t.trust}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Notice>Opening a transfer works offline. Nothing is sent anywhere until school sync is set up.</Notice>
    </div>
  );
}

function decodeImageData(img: ImageData): string | null {
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

function Scanner({ onCode, onFallback }: { onCode(t: string): void; onFallback(m: Mode): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'denied' | 'nocamera' | 'insecure' | 'error'>('idle');
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number>(0);
  const done = useRef(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
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
        <video ref={video} playsInline muted aria-label="Camera preview" />
        {state !== 'running' && <div className="vf-placeholder">Camera is off</div>}
      </div>
      {state === 'running' ? (
        <button onClick={() => { stop(); setState('idle'); }}>Cancel scan</button>
      ) : (
        <button className="primary" onClick={start} disabled={state === 'starting'}>{state === 'starting' ? 'Starting camera…' : 'Start camera'}</button>
      )}
      {state === 'denied' && (
        <ErrorBox title="Camera permission was refused">
          Allow camera access for this site in your browser settings, or{' '}
          <button className="link" onClick={() => onFallback('upload')}>use a photo</button> /{' '}
          <button className="link" onClick={() => onFallback('paste')}>paste the code</button>.
        </ErrorBox>
      )}
      {state === 'nocamera' && <ErrorBox title="No camera found">Use a photo of the slip or paste the code instead.</ErrorBox>}
      {state === 'insecure' && <ErrorBox title="Camera needs a secure (https) connection">Open the app from its https address, or use a photo or paste.</ErrorBox>}
      {state === 'error' && <ErrorBox title="The camera could not start">Close other apps using the camera and try again, or use a photo.</ErrorBox>}
    </section>
  );
}

function Upload({ onCode }: { onCode(t: string): void }) {
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
      setErr('No QR code found in this image. Take the photo straight on, fill the frame with the code, and avoid glare.');
    } catch {
      setErr('This file could not be opened as an image.');
    }
  }
  return (
    <section className="card stack">
      <label className="file">
        Choose or take a photo of the slip
        <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {err && <ErrorBox title={err} />}
    </section>
  );
}

function Paste({ onCode }: { onCode(t: string): void }) {
  const [text, setText] = useState('');
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); onCode(text); }}>
      <label>
        Transfer code (starts with CED)
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" className="mono" />
      </label>
      <button className="primary" disabled={!text.trim()}>Open transfer</button>
    </form>
  );
}
