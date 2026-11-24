// PLACEHOLDER — owner: Saisagar. Real screen comes in task S4 (prompt P-S4).
// Props are a shared contract (docs/ContinuED_TEAM_PLAN.md section 9): add-only.
import type { SkillMap } from '../types/capsule.ts';
import type { LangCode } from '../types/language.ts';
import type { Locale } from '../locales/index.ts';

export interface CreateTabProps {
  lang: LangCode;
  locale: Locale;
  demo?: { id: string; age: number; skills: SkillMap } | null; // filled by "Load demo"
  onOpenInScan: (code: string) => void;
}

export function CreateTab(props: CreateTabProps) {
  return (
    <section className="rounded-lg border border-muted/30 p-4" data-lang={props.lang}>
      <h2 className="text-lg font-semibold text-brand">{props.locale.ui.tabCreate}</h2>
      <p className="text-sm text-muted">Create screen — coming in task S4.</p>
    </section>
  );
}
