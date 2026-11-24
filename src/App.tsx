// Owner: Omkar. Skeleton shell — full wiring comes in task O7 (prompt P-O7).
import { useState } from 'react';
import { APP_NAME } from './config.ts';
import { LOCALES } from './locales/index.ts';
import type { LangCode } from './types/language.ts';
import { CreateTab } from './components/CreateTab.tsx';
import { ScanTab } from './components/ScanTab.tsx';

type Tab = 'create' | 'scan';

export default function App() {
  const [tab, setTab] = useState<Tab>('create');
  const lang: LangCode = 'en';
  const locale = LOCALES[lang];

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-brand">{APP_NAME}</h1>
        <p className="text-sm text-muted">Work in progress — core MVP by 26 Nov.</p>
      </header>

      <nav className="mb-4 flex gap-2">
        {(['create', 'scan'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              'rounded-md px-3 py-2 text-sm font-medium ' +
              (tab === id ? 'bg-brand text-white' : 'border border-muted/40 text-muted')
            }
          >
            {id === 'create' ? locale.ui.tabCreate : locale.ui.tabScan}
          </button>
        ))}
      </nav>

      {tab === 'create' ? (
        <CreateTab lang={lang} locale={locale} demo={null} onOpenInScan={() => setTab('scan')} />
      ) : (
        <ScanTab lang={lang} locale={locale} initialCode={null} />
      )}
    </div>
  );
}
