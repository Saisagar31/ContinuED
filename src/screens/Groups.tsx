import { useAsync, useApp, useWs } from '../app/context';
import { Empty, Loading, SkillLabel } from '../app/ui';
import { t } from '../content/i18n';
import { skillText } from '../content/packs';
import { SKILL_BY_ID } from '../content/skills';
import { summarise } from '../assess/stubEngine';
import { groupByNextSkill } from '../plan/plan';
import { decodeCapsule } from '../transfer/capsule';
import { deviceTrustStore } from '../transfer/deviceTrust';
import type { SkillSummary } from '../domain/types';

export function Groups() {
  const ws = useWs();
  const { uiLang: L } = useApp();
  const data = useAsync(async () => {
    const [learners, sessions, transfers] = await Promise.all([ws.learners(), ws.sessions(), ws.transfers()]);
    const fromTransfers = new Map<string, SkillSummary[]>();
    for (const tr of transfers) {
      const r = await decodeCapsule(tr.code, deviceTrustStore());
      if (r.ok && !fromTransfers.has(r.envelope.lp)) fromTransfers.set(r.envelope.lp, r.envelope.s);
    }
    const rows = learners
      .map((l) => {
        const latest = sessions.find((s) => s.learnerId === l.id && s.status === 'completed');
        const summary = latest ? summarise(latest) : fromTransfers.get(l.id);
        return summary ? { learner: l, summary, source: latest ? 'assessment' : 'transfer' } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { groups: groupByNextSkill(rows), unassessed: learners.length - rows.length };
  }, [ws.teacherId]);

  if (data.loading && !data.data) return <Loading label={t(L, 'common.loading')} />;
  const { groups, unassessed } = data.data!;

  return (
    <div className="stack">
      <h1>{t(L, 'groups.title')}</h1>
      <p className="muted small">{t(L, 'groups.intro')}</p>
      {groups.size === 0 && <Empty title={t(L, 'groups.empty')}>{t(L, 'groups.emptyHint')}</Empty>}
      {[...groups].map(([key, members]) => (
        <section key={key} className="card">
          <h2>
            {SKILL_BY_ID[key] ? <SkillLabel id={key} lang={L} /> : key === 'all_mastered' ? t(L, 'groups.allMastered') : key === 'insufficient' ? t(L, 'status.insufficient') : t(L, 'groups.noResults')}
            <span className="muted small"> · {members.length}</span>
          </h2>
          {SKILL_BY_ID[key] && <p className="small muted">{t(L, 'groups.try', { activity: skillText(L, key)?.activities[0]?.title ?? SKILL_BY_ID[key].activities[0].title })}</p>}
          <ul className="chips">
            {members.map((m) => (
              <li key={m.learner.id}>
                <a href={`#/learner/${m.learner.id}`} className="chip">
                  <span className="mono">{m.learner.id}</span>
                  {m.learner.label ? ` · ${m.learner.label}` : ''}
                  {m.source === 'transfer' ? ' ⇩' : ''}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {unassessed > 0 && <p className="small muted">{t(L, 'groups.unassessed', { n: unassessed })}</p>}
    </div>
  );
}
