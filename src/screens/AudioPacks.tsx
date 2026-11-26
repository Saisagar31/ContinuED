/**
 * Audio packs (task 10): download one language's reviewed recordings while
 * online, then play them offline. The pack manager verifies every clip before
 * switching, so a failed or interrupted download leaves the previous pack working.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../app/context';
import { Notice } from '../app/ui';
import { AUDIO_BASE_URL } from '../app/services';
import { activePack, installPack } from '../audio/packManager';
import { LANG_NAMES, t } from '../content/i18n';
import { LANGS, type LangCode } from '../domain/types';

interface Row {
  version?: string;
  clips?: number;
  busy?: boolean;
  message?: string;
  failed?: boolean;
}

export function AudioPacks() {
  const { uiLang: L, online } = useApp();
  const [rows, setRows] = useState<Partial<Record<LangCode, Row>>>({});

  useEffect(() => {
    let live = true;
    void Promise.all(LANGS.map(async (l) => [l, await activePack(l)] as const)).then((all) => {
      if (!live) return;
      setRows(Object.fromEntries(all.map(([l, m]) => [l, m ? { version: m.packVersion, clips: m.clips.filter((c) => c.reviewStatus === 'approved').length } : {}])));
    });
    return () => {
      live = false;
    };
  }, []);

  async function install(lang: LangCode) {
    if (!AUDIO_BASE_URL) return;
    setRows((r) => ({ ...r, [lang]: { ...r[lang], busy: true, message: undefined, failed: false } }));
    const res = await installPack(lang, AUDIO_BASE_URL);
    setRows((r) => ({
      ...r,
      [lang]: res.ok
        ? { version: res.packVersion, clips: res.clips, message: t(L, 'audio.ok') }
        : { ...r[lang], busy: false, failed: true, message: t(L, 'audio.err', { reason: res.error }) },
    }));
  }

  return (
    <div className="stack">
      <h1>{t(L, 'audio.title')}</h1>
      <p className="muted small">{t(L, 'audio.intro')}</p>
      {!AUDIO_BASE_URL && <Notice>{t(L, 'audio.notConfigured')}</Notice>}
      {AUDIO_BASE_URL && !online && <Notice kind="warn">{t(L, 'app.offline')}</Notice>}
      <ul className="list card">
        {LANGS.map((l) => {
          const r = rows[l] ?? {};
          return (
            <li key={l} className="stack">
              <div className="row between">
                <strong lang={l}>{LANG_NAMES[l].native}</strong>
                <span className="muted small">{r.version ? t(L, 'audio.installed', { version: r.version, clips: r.clips ?? 0 }) : t(L, 'audio.none')}</span>
              </div>
              {AUDIO_BASE_URL && (
                <button onClick={() => install(l)} disabled={!online || r.busy}>
                  {r.busy ? t(L, 'audio.installing') : t(L, 'audio.install')}
                </button>
              )}
              {r.message && (r.failed ? <div className="error" role="alert">{r.message}</div> : <p className="small" role="status">{r.message}</p>)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
