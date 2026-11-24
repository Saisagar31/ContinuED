import type { LangCode } from '../types/language.ts';
import type { Locale } from './types.ts';
import en from './en.ts';
import mr from './mr.ts';
import kn from './kn.ts';

export const LOCALES: Record<LangCode, Locale> = { en, mr, kn };

export type { Locale, SkillText, UiText } from './types.ts';
