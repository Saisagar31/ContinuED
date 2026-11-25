import { useAsync, useApp, useWs } from '../app/context';
import { Empty, Loading, SkillLabel } from '../app/ui';
import { t } from '../content/i18n';
import { SKILL_BY_ID } from '../content/skills';
import { summarise } from '../assess/stubEngine';
import { groupByNextSkill } from '../plan/plan';
import { decodeCapsule } from '../transfer/capsule';
import { deviceTrustStore } from '../transfer/deviceTrust';
import type { SkillSummary } from '../domain/types';

export function Groups() {
  const ws = useWs();
  const { uiLang } = useApp();
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

  if (data.loading && !data.data) return <Loading />;
  const { groups, unassessed } = data.data!;

  return (
    <div className="stack">
      <h1>Groups for the next activity</h1>
      <p className="muted small">Learners are grouped by the skill their latest result points to. Use it to plan tomorrow’s class.</p>
      {groups.size === 0 && <Empty title="No results to group yet">Complete an assessment or add a transferred learner.</Empty>}
      {[...groups].map(([key, members]) => (
        <section key={key} className="card">
          <h2>
            {SKILL_BY_ID[key] ? <SkillLabel id={key} lang={uiLang} /> : key === 'all_mastered' ? 'All skills mastered' : key === 'insufficient' ? t(uiLang, 'status.insufficient') : 'No results'}
            <span className="muted small"> · {members.length}</span>
          </h2>
          {SKILL_BY_ID[key] && <p className="small muted">Try: {SKILL_BY_ID[key].activities[0].title}</p>}
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
      {unassessed > 0 && <p className="small muted">{unassessed} learner{unassessed === 1 ? '' : 's'} without results yet.</p>}
    </div>
  );
}
