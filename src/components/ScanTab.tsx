// PLACEHOLDER — owner: Venkat. Real screen comes in task V5 (prompt P-V5).
// Props are a shared contract (docs/ContinuED_TEAM_PLAN.md section 9): add-only.
import type { LangCode } from '../types/language.ts';
import type { Locale } from '../locales/index.ts';

export interface ScanTabProps {
  lang: LangCode;
  locale: Locale;
  initialCode?: string | null;
}

export function ScanTab(props: ScanTabProps) {
  return (
    <section className="rounded-lg border border-muted/30 p-4" data-lang={props.lang}>
      <h2 className="text-lg font-semibold text-brand">{props.locale.ui.tabScan}</h2>
      <p className="text-sm text-muted">Scan screen — coming in task V5.</p>
    </section>
  );
}
