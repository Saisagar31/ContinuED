import type { SkillId } from '../data/competencyGraph.ts';

// ADD-ONLY: never rename or delete a key. New keys are added by Ramith
// (owner of src/locales/*) to this file and all locale files in one commit.

export interface SkillText {
  title: string;
  prompt: string; // one oral question for the child (60–85 characters)
  activity: string; // a 15-minute classroom activity (95–125 characters)
  group: string; // peer-group name
}

export interface UiText {
  // App
  tagline: string;
  online: string;
  offline: string;
  language: string;
  loadDemo: string;
  tabCreate: string;
  tabScan: string;
  footer: string;
  // Create
  studentId: string;
  newId: string;
  age: string;
  ageError: string;
  idError: string;
  numeracy: string;
  literacy: string;
  mastered: string;
  inProgress: string;
  needsHelp: string;
  notAssessed: string;
  listen: string;
  seal: string;
  capsuleReady: string;
  characters: string;
  zeroPii: string;
  sealed: string;
  copyCode: string;
  copied: string;
  openInScan: string;
  // Scan
  pasteHint: string;
  pastePlaceholder: string;
  open: string;
  verified: string;
  origin: string;
  assessedOn: string;
  errFormat: string;
  errCorrupt: string;
  errSignature: string;
  errCrypto: string;
  rootBottleneck: string;
  allMastered: string;
  skillMap: string;
  startHere: string;
  peerGroup: string;
  activity: string;
  playInOrigin: string; // contains "{lang}"
}

export interface Locale {
  ui: UiText;
  skills: Record<SkillId, SkillText>;
}
