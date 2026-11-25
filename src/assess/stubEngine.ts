/**
 * STUB assessment engine — just enough to drive the UI prototype end to end
 * (question -> review -> QR -> receiving plan). Task 06 (Sai) owns the real
 * evidence-based engine; it should replace `nextItem` and `suggestStatus`
 * behind the same signatures.
 */
import { SKILL_BY_ID, orderedSkills } from '../content/skills';
import type { Attempt, EvidenceCounts, LangCode, PresentedItem, Session, SkillStatus, SkillSummary } from '../domain/types';

const MAX_ITEMS = 16;
const MAX_PER_SKILL = 3;

const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

interface Gen {
  id: string; // canonical identity for repeat protection
  prompt: string;
  expected: string;
}

function generate(skillId: string, band: number, lang: LangCode): Gen {
  switch (skillId) {
    case 'num.recognition': {
      const n = band === 1 ? rnd(1, 20) : rnd(21, 99);
      return { id: `nr:${n}`, prompt: `Point to the number and ask the learner to say it:\n\n${n}`, expected: String(n) };
    }
    case 'num.place_value': {
      const t = rnd(1, 9), o = rnd(0, 9);
      return band === 1
        ? { id: `pv:split:${t}${o}`, prompt: `How many tens and how many ones are in ${t}${o}?`, expected: `${t} tens, ${o} ones` }
        : { id: `pv:join:${t}${o}`, prompt: `What number is ${t} tens and ${o} ones?`, expected: `${t}${o}` };
    }
    case 'num.add_no_carry': {
      const a = band === 1 ? rnd(1, 9) : rnd(11, 60);
      const ao = a % 10;
      const bo = rnd(0, 9 - ao);
      const b = band === 1 ? rnd(1, 3) * 10 + bo : rnd(1, Math.floor((99 - a) / 10) || 1) * 10 + bo;
      const [x, y] = a <= b ? [a, b] : [b, a];
      return { id: `add:${x}+${y}`, prompt: `${a} + ${b} = ?`, expected: String(a + b) };
    }
    case 'num.sub_borrow': {
      const a = band === 1 ? rnd(21, 49) : rnd(51, 99);
      let bo = rnd((a % 10) + 1, 9);
      if (bo > 9) bo = 9;
      const b = rnd(1, Math.floor(a / 10) - 1) * 10 + bo;
      if (a % 10 >= bo || b >= a) return generate(skillId, band, lang);
      return { id: `sub:${a}-${b}`, prompt: `${a} − ${b} = ?`, expected: String(a - b) };
    }
    case 'num.fractions': {
      if (band === 1) {
        const n = rnd(2, 10) * 2;
        return { id: `half:${n}`, prompt: `Put ${n} counters in front of the learner. Ask them to give you half.`, expected: String(n / 2) };
      }
      const n = rnd(2, 5) * 4;
      return { id: `quarter:${n}`, prompt: `Put ${n} counters out. Ask for one quarter.`, expected: String(n / 4) };
    }
    default: {
      // Literacy stimuli must be authored per language and script (task 04/09).
      const deck = lang === 'en' ? ENGLISH_SAMPLE[skillId]?.[band - 1] : undefined;
      if (deck) {
        const w = deck[rnd(0, deck.length - 1)];
        return { id: `${skillId}:en:${w}`, prompt: LIT_PROMPT[skillId](w), expected: 'Teacher judges against the rubric' };
      }
      const card = rnd(1, 12);
      return {
        id: `${skillId}:${lang}:card${band}-${card}`,
        prompt: `${SKILL_BY_ID[skillId].oralCheck}\n\nUse card ${band}-${card} from your printed ${lang.toUpperCase()} sample deck. (Reviewed ${lang.toUpperCase()} stimuli are pending — task 04/09.)`,
        expected: 'Teacher judges against the rubric',
      };
    }
  }
}

const ENGLISH_SAMPLE: Record<string, string[][]> = {
  'lit.initial_sounds': [['sun', 'map', 'fan', 'leg'], ['ship', 'chair', 'thumb', 'frog']],
  'lit.decoding': [['cat', 'pen', 'sit', 'hot'], ['stop', 'milk', 'jump', 'frog']],
  'lit.sentence_reading': [['The dog runs.', 'I see a red hen.'], ['The cat sat on the mat.', 'We go to school by bus.']],
};
const LIT_PROMPT: Record<string, (w: string) => string> = {
  'lit.initial_sounds': (w) => `Say the word “${w}” aloud. Ask: what sound does it begin with?`,
  'lit.decoding': (w) => `Show the card without saying it. Ask the learner to read:\n\n${w}`,
  'lit.sentence_reading': (w) => `Show the sentence. Ask the learner to read it and say what it means:\n\n${w}`,
};

export function evidenceFor(attempts: Attempt[], skillId: string): EvidenceCounts {
  const e: EvidenceCounts = { independent: 0, prompted: 0, incorrect: 0, skipped: 0 };
  for (const a of attempts) if (a.skillId === skillId) e[a.observation]++;
  return e;
}

export function suggestStatus(e: EvidenceCounts): SkillStatus {
  if (e.independent >= 2) return 'mastered';
  if (e.independent + e.prompted >= 1) return 'developing';
  if (e.incorrect >= 2) return 'not_yet';
  return 'insufficient';
}

function present(skillId: string, band: number, lang: LangCode, seen: Set<string>, reason: string): PresentedItem | undefined {
  // Random search is fine for a stub; the real engine (task 06) should enumerate eligible variants.
  for (let i = 0; i < 400; i++) {
    const g = generate(skillId, band, lang);
    if (!seen.has(g.id)) return { itemId: g.id, skillId, band, prompt: g.prompt, expected: g.expected, selectionReason: reason, presentedAt: new Date().toISOString() };
  }
  return undefined; // eligible material exhausted
}

/**
 * Picks the next item given the session so far and all items this learner has
 * already seen (across sessions). Returns undefined when the session should stop.
 */
export function nextItem(session: Session, seenAcrossSessions: Set<string>, priorConfirmed: Record<string, SkillStatus> = {}, alternative = false): PresentedItem | undefined {
  const { attempts, assessmentLang: lang } = session;
  if (attempts.length >= MAX_ITEMS) return undefined;
  const seen = new Set([...seenAcrossSessions, ...attempts.map((a) => a.itemId), ...(session.current ? [session.current.itemId] : [])]);
  const order = orderedSkills();
  const last = attempts[attempts.length - 1];

  if (alternative && session.current) {
    return present(session.current.skillId, session.current.band, lang, seen, 'Teacher asked for an alternative (not counted as an attempt)');
  }

  if (!last) {
    const start = order.find((s) => priorConfirmed[s.id] !== 'mastered') ?? order[0];
    const why = Object.keys(priorConfirmed).length ? `First skill not mastered in the previous session` : 'Entry check: first skill in the sample map';
    return present(start.id, 1, lang, seen, why);
  }

  const onSkill = attempts.filter((a) => a.skillId === last.skillId).length;
  const tried = new Set(attempts.map((a) => a.skillId));
  const nextUntried = () => order.find((s) => !tried.has(s.id) && priorConfirmed[s.id] !== 'mastered');
  const moveOn = (why: string) => {
    const n = nextUntried();
    return n ? present(n.id, 1, lang, seen, why) : undefined;
  };

  if (onSkill >= MAX_PER_SKILL) return moveOn(`Reached ${MAX_PER_SKILL} items on ${SKILL_BY_ID[last.skillId].name}; moving on`);

  switch (last.observation) {
    case 'independent':
      return last.band < 2
        ? present(last.skillId, 2, lang, seen, 'Independent success → harder item on the same skill')
        : moveOn('Independent success at the harder band → next skill');
    case 'prompted':
      return present(last.skillId, last.band, lang, seen, 'Needed prompting → another example at the same level');
    case 'incorrect': {
      const pre = SKILL_BY_ID[last.skillId].prerequisites.find((p) => !tried.has(p) && priorConfirmed[p] !== 'mastered');
      return pre
        ? present(pre, 1, lang, seen, `Incorrect → check prerequisite ${SKILL_BY_ID[pre].name}`)
        : present(last.skillId, 1, lang, seen, 'Incorrect → another format at the entry level');
    }
    case 'skipped':
      return onSkill >= 2 ? moveOn('Skipped twice → ability undecided; moving on') : present(last.skillId, last.band, lang, seen, 'Skipped → offer an alternative item');
  }
}

/** Builds the transferable summary from a completed session (teacher-confirmed statuses only). */
export function summarise(session: Session): SkillSummary[] {
  const ids = orderedSkills().map((s) => s.id).filter((id) => session.attempts.some((a) => a.skillId === id) || session.confirmed[id]);
  return ids.map((skillId) => ({ skillId, status: session.confirmed[skillId] ?? 'insufficient', evidence: evidenceFor(session.attempts, skillId) }));
}
