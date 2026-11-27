import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useApp } from '../app/context';
import { LANG_NAMES } from '../content/i18n';
import type { LangCode } from '../domain/types';

const languages: LangCode[] = ['en', 'mr', 'kn'];
export function LangStrip() {
  const { uiLang, setUiLang } = useApp();
  const row = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState({ x: 0, width: 0 });
  useLayoutEffect(() => {
    const active = tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    setUnderline(active ? { x: active.offsetLeft, width: active.offsetWidth } : { x: 0, width: 0 });
  }, [uiLang]);
  const keys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % languages.length : event.key === 'ArrowLeft' ? (index + languages.length - 1) % languages.length : event.key === 'Home' ? 0 : event.key === 'End' ? languages.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    const target = row.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
    target?.focus(); target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  return <div className="lang-strip" aria-label="Languages and skills">
    <button type="button" className="strip-arrow" aria-label="Scroll chips left" onClick={() => row.current?.scrollBy({ left: -170, behavior: 'smooth' })}>‹</button>
    <div className="strip-scroll" ref={row}>
      <div role="tablist" aria-label="Interface language" className="strip-language-tabs" ref={tabs}>
        {languages.map((lang, i) => <button key={lang} type="button" role="tab" aria-selected={uiLang === lang} className="strip-chip" onClick={() => setUiLang(lang)} onKeyDown={e => keys(e, i)}>
          <span className="strip-tile" aria-hidden="true">{lang === 'en' ? 'A' : lang === 'mr' ? 'अ' : 'ಅ'}</span>{LANG_NAMES[lang].native}
        </button>)}
        <span className="strip-indicator" aria-hidden="true" style={{ transform: `translateX(${underline.x}px) scaleX(${underline.width})`, opacity: underline.width ? 1 : 0 }} />
      </div>
      <span className="strip-chip strip-skill"><span className="strip-tile" aria-hidden="true">▤</span>Reading</span>
      <span className="strip-chip strip-skill"><span className="strip-tile" aria-hidden="true">＋</span>Maths</span>
    </div>
    <button type="button" className="strip-arrow" aria-label="Scroll chips right" onClick={() => row.current?.scrollBy({ left: 170, behavior: 'smooth' })}>›</button>
  </div>;
}
