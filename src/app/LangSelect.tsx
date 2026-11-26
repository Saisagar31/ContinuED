import { useApp } from './context';
import { LANG_NAMES, t } from '../content/i18n';
import { LANGS, type LangCode } from '../domain/types';

/** Interface-language picker, shared by the top bar and the sign-in screen. */
export function LangSelect() {
  const { uiLang, setUiLang } = useApp();
  return (
    <label className="lang-select">
      <span className="sr-only">{t(uiLang, 'app.uiLang')}</span>
      <select value={uiLang} onChange={(e) => setUiLang(e.target.value as LangCode)} aria-label={t(uiLang, 'app.uiLang')}>
        {LANGS.map((l) => (
          <option key={l} value={l} lang={l}>{LANG_NAMES[l].native}</option>
        ))}
      </select>
    </label>
  );
}
