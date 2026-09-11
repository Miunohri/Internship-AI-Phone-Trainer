import type { Speaker } from "@/types/training";

export type PersonaWithScenarios = {
  id: string;
  name: string;
  description: string;
  openingLine: string;
  behavioralRules: string;
  primarySkills: string | null;
  scenarios: ScenarioRecord[];
};

export type ScenarioRecord = {
  id: string;
  title: string;
  vehicle: string | null;
  concern: string | null;
  difficulty: string | null;
  promptNotes: string | null;
};

export type ConversationTurnRecord = {
  speaker: Speaker;
  text: string;
  sequence: number;
};