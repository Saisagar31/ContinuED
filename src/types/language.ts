export type LangCode = 'en' | 'mr' | 'kn';

export const SUPPORTED_LANGUAGES: Record<
  LangCode,
  { nativeName: string; englishName: string; speechLocale: string }
> = {
  en: { nativeName: 'English', englishName: 'English', speechLocale: 'en-IN' },
  mr: { nativeName: 'मराठी', englishName: 'Marathi', speechLocale: 'mr-IN' },
  kn: { nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', speechLocale: 'kn-IN' },
};

export const LANG_CODES: LangCode[] = ['en', 'mr', 'kn'];

export function isLangCode(x: unknown): x is LangCode {
  return typeof x === 'string' && (LANG_CODES as string[]).includes(x);
}
