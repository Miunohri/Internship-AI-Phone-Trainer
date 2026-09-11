export type Speaker = "ADVISOR" | "AI_CUSTOMER" | "SYSTEM";

export type SessionChannel = "BROWSER" | "TWILIO";

export type SessionStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type StartSessionRequest = {
  userId: string;
  personaId: string;
  scenarioId: string;
  channel?: SessionChannel;
};

export type TranscriptTurnRequest = {
  speaker: Speaker;
  text: string;
};

export type ScorecardCriterionScore = {
  criterionId: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  sortOrder: number;
  feedback: string;
  evidence?: string;
};

export type ScorecardServiceResponse = {
  schemaVersion: "1.0";
  sessionId: string;
  scorecardTemplateId: string;
  totalScore: number;
  maxScore: number;
  summary: string;
  actionPlan: string;
  criteria: ScorecardCriterionScore[];
};