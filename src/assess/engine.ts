/**
 * Evidence-based assessment engine (task 06). Replaces the prototype stub.
 *
 * Pure functions: the screen persists what they return (the presented item is
 * saved BEFORE display, so a restart resumes the exact question).
 *
 * How the next question is chosen (rules and limits live in content/rubric.ts,
 * versioned with the content, and are placeholders for educator approval):
 *  1. Start at the first skill (tie-rule order) the learner had not mastered in
 *     the previous session, or the first skill for a new learner.
 *  2. After an answer on skill S:
 *     - S already has enough evidence (mastered, not yet, item or skip limit) → next skill.
 *     - independent  → harder band; at the top band, a different format to confirm.
 *     - prompted     → another example at the same band in a different format.
 *     - incorrect    → check the first prerequisite with no evidence yet; else a
 *                      different format at the entry band.
 *     - skipped      → an alternative item (ability stays undecided).
 *  3. "Next skill" skips skills mastered last time and skills whose prerequisite
 *     this session already points to "not yet".
 *  4. A fresh item is always one the learner has not seen in any session
 *     (canonical IDs, so a cosmetic or language change cannot bypass this).
 *     If none is left the engine moves on, and returns undefined when nothing
 *     eligible remains or the session limit is reached.
 *
 * `selectionReason` is stored as a language-neutral code ("prereq|num.place_value")
 * so the teacher reads it in whatever interface language they use.
 */
import { SKILL_BY_ID, orderedSkills } from '../content/skills';
import { eligibleItems, type QuestionItem } from '../content/questions';
import { STOPPING, TOP_BAND, skillSettled, suggestFromAttempts, type Band } from '../content/rubric';
import { skillName, t, type MsgKey } from '../content/i18n';
import { en } from '../content/packs';
import type { Attempt, EvidenceCounts, LangCode, PresentedItem, Session, SkillStatus, SkillSummary } from '../domain/types';

export type ReasonCode = 'entry' | 'prior' | 'harder' | 'transfer' | 'again' | 'prereq' | 'easier' | 'skip' | 'next' | 'alternative';

export interface EngineOptions {
  /** Random source, injectable so tests are reproducible. */
  random?: () => number;
}

const reason = (code: ReasonCode, skillId = '') => (skillId ? `${code}|${skillId}` : code);

/** The selection reason in the teacher's interface language. Older free-text reasons are shown as stored. */
export function reasonText(lang: LangCode, stored: string): string {
  const [code, skill] = stored.split('|');
  const key = `reason.${code}` as MsgKey;
  if (!(key in en.ui)) return stored;
  return t(lang, key, { skill: skill ? skillName(lang, skill) : '' });
}

export function evidenceFor(attempts: Attempt[], skillId: string): EvidenceCounts {
  const e: EvidenceCounts = { independent: 0, prompted: 0, incorrect: 0, skipped: 0 };
  for (const a of attempts) if (a.skillId === skillId) e[a.observation]++;
  return e;
}

/** Band-aware suggestion for one skill (rubric.suggestFromAttempts). Use this where attempts are available. */
export function suggestStatusFor(attempts: Attempt[], skillId: string): SkillStatus {
  return suggestFromAttempts(attempts.filter((a) => a.skillId === skillId));
}

/**
 * Counts-only suggestion, kept for callers that have no band information.
 * It cannot see bands, so it never suggests mastered from counts alone unless
 * there are at least 3 independent successes.
 */
export function suggestStatus(e: EvidenceCounts): SkillStatus {
  if (e.independent >= 3) return 'mastered';
  if (e.independent + e.prompted >= 1) return 'developing';
  if (e.incorrect >= 2) return 'not_yet';
  return 'insufficient';
}

function toPresented(item: QuestionItem, why: string): PresentedItem {
  return {
    itemId: item.itemId,
    skillId: item.skillId,
    band: item.band,
    prompt: item.prompt,
    expected: item.expected,
    selectionReason: why,
    presentedAt: new Date().toISOString(),
    familyId: item.familyId,
    ...(item.stimulus !== undefined ? { stimulus: item.stimulus } : {}),
    audio: item.audio,
    audioContentId: item.audioContentId,
  };
}

/**
 * Picks the next item given the session so far and every item this learner has
 * already seen (across sessions). Returns undefined when the session should stop.
 * With `alternative`, replaces the current item with another one on the same
 * skill and band (not counted as an attempt).
 */
export function nextItem(
  session: Session,
  seenAcrossSessions: ReadonlySet<string>,
  priorConfirmed: Record<string, SkillStatus> = {},
  alternative = false,
  opts: EngineOptions = {},
): PresentedItem | undefined {
  const rnd = opts.random ?? Math.random;
  const { attempts, assessmentLang: lang } = session;
  const seen = new Set([...seenAcrossSessions, ...attempts.map((a) => a.itemId), ...(session.current ? [session.current.itemId] : [])]);
  const on = (skillId: string) => attempts.filter((a) => a.skillId === skillId);
  const familiesUsed = (skillId: string) => new Set(on(skillId).map((a) => a.familyId).filter(Boolean));

  /** An unseen item for skill/band, preferring a format not used yet on this skill. */
  const pick = (skillId: string, band: Band, why: string, avoidFamily?: string): PresentedItem | undefined => {
    const items = eligibleItems(skillId, band, lang, seen);
    if (items.length === 0) return undefined;
    const used = familiesUsed(skillId);
    if (avoidFamily) used.add(avoidFamily);
    const fresh = items.filter((i) => !used.has(i.familyId));
    const notAvoided = items.filter((i) => i.familyId !== avoidFamily);
    const pool = fresh.length ? fresh : notAvoided.length ? notAvoided : items;
    return toPresented(pool[Math.floor(rnd() * pool.length)], why);
  };

  if (alternative) {
    const cur = session.current;
    if (!cur) return undefined;
    return pick(cur.skillId, cur.band as Band, reason('alternative'), cur.familyId);
  }
  if (attempts.length >= STOPPING.maxItems) return undefined;

  const order = orderedSkills();
  const tried = (id: string) => on(id).length > 0;
  /** Any earlier skill (direct or indirect prerequisite) that points to "not yet" makes the skill pointless to test now. */
  const blocked = (id: string, visiting = new Set<string>()): boolean =>
    (SKILL_BY_ID[id]?.prerequisites ?? []).some((p) => {
      if (visiting.has(p)) return false;
      visiting.add(p);
      return suggestFromAttempts(on(p)) === 'not_yet' || priorConfirmed[p] === 'not_yet' || blocked(p, visiting);
    });
  const candidates = () => order.filter((s) => !tried(s.id) && priorConfirmed[s.id] !== 'mastered' && !blocked(s.id));

  const moveOn = (code: ReasonCode): PresentedItem | undefined => {
    for (const s of candidates()) {
      const it = pick(s.id, 1, reason(code, s.id)) ?? pick(s.id, TOP_BAND, reason(code, s.id));
      if (it) return it;
    }
    return undefined;
  };

  const last = attempts[attempts.length - 1];
  if (!last) return moveOn(Object.keys(priorConfirmed).length ? 'prior' : 'entry');

  const s = last.skillId;
  const band = last.band as Band;
  if (skillSettled(on(s))) return moveOn('next');

  let item: PresentedItem | undefined;
  switch (last.observation) {
    case 'independent':
      item = band < TOP_BAND ? pick(s, (band + 1) as Band, reason('harder', s)) : pick(s, TOP_BAND, reason('transfer', s), last.familyId);
      break;
    case 'prompted':
      item = pick(s, band, reason('again', s), last.familyId);
      break;
    case 'incorrect': {
      const pre = SKILL_BY_ID[s]?.prerequisites.find((p) => !tried(p) && priorConfirmed[p] !== 'mastered');
      item = pre ? pick(pre, 1, reason('prereq', pre)) : pick(s, 1, reason('easier', s), last.familyId);
      break;
    }
    case 'skipped':
      item = pick(s, band, reason('skip', s), last.familyId);
      break;
  }
  // The preferred band is used up for this learner: try the other band, then move on.
  return item ?? pick(s, band === 1 ? TOP_BAND : 1, reason('again', s)) ?? moveOn('next');
}

/** Builds the transferable summary from a completed session (teacher-confirmed statuses only). */
export function summarise(session: Session): SkillSummary[] {
  const ids = orderedSkills()
    .map((s) => s.id)
    .filter((id) => session.attempts.some((a) => a.skillId === id) || session.confirmed[id]);
  return ids.map((skillId) => ({ skillId, status: session.confirmed[skillId] ?? 'insufficient', evidence: evidenceFor(session.attempts, skillId) }));
}
