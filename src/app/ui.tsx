import type { ReactNode } from 'react';
import { t, skillName } from '../content/i18n';
import type { LangCode, SkillStatus } from '../domain/types';

export function StatusPill({ status, lang }: { status: SkillStatus; lang: LangCode }) {
  return <span className={`pill pill-${status}`}>{t(lang, `status.${status}`)}</span>;
}

export function SkillLabel({ id, lang }: { id: string; lang: LangCode }) {
  return <span lang={lang}>{skillName(lang, id)}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      {label}
    </div>
  );
}

export function ErrorBox({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="error" role="alert">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn'; children: ReactNode }) {
  return <div className={`notice notice-${kind}`}>{children}</div>;
}

/** YYYY-MM-DD in the device's local time zone. */
export function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso?: string) {
  if (!iso) return '—';
  // Date-only strings are calendar days; parse them as local, not UTC midnight.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
