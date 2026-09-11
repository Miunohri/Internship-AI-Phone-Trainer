// central place for all api calls and shared types
// shapes match the Prisma schema and API routes

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADVISOR" | "MANAGER" | "ADMIN";
  weeklyCallGoal: number;
  isActive: boolean;
}
  export interface Scenario {
    id: string;
    title: string;
    type: "INBOUND" | "OUTBOUND";
    personaId: string;
    vehicle?: string | null;
    concern?: string | null;
    difficulty?: string | null;
    promptNotes?: string | null;
    isActive: boolean;
  }
  export interface Persona {
    id: string;
    name: string;
    description: string;
    openingLine: string;
    behavioralRules: string;
    primarySkills?: string | null;
    isActive: boolean;
    scenarios?: Scenario[];
  }
  export interface ScorecardCriterion {
    id: string;
    templateId: string;
    name: string;
    description: string;
    maxScore: number;
    weight: number;
    sortOrder: number;
    isActive: boolean;
  }

  export interface ScorecardTemplate {
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    criteria?: ScorecardCriterion[];
  }

  export interface ScorecardResult {
    id: string;
    sessionId: string;
    templateId: string;
    totalScore: number;
    maxScore: number;
    summary?: string | null;
    actionPlan?: string | null;
    createdAt: string;
    criterionResults?: CriterionResult[];
    template?: ScorecardTemplate;
  }
  export interface CriterionResult {
    id: string;
    criterionId: string;
    score: number;
    feedback: string;
    evidence?: string | null;
    criterionNameSnapshot?: string | null;
    criterionMaxSnapshot?: number | null;
    criterionWeightSnapshot?: number | null;
    criterionOrderSnapshot?: number | null;
    criterion?: ScorecardCriterion;
  }

  export interface Session {
    id: string;
    userId: string;
    personaId: string;
    scenarioId: string;
    channel: "BROWSER" | "TWILIO";
    status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    startedAt: string;
    endedAt?: string | null;
    user?: User;
    persona?: Persona;
    scenario?: Scenario;
    scorecardResult?: ScorecardResult | null;
  }

  export interface Turn {
    id: string;
    sessionId: string;
    speaker: "ADVISOR" | "AI_CUSTOMER" | "SYSTEM";
    text: string;
    sequence: number;
    createdAt: string;
  }

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status} ${url}`;

    try {
      const body = (await res.json()) as { error?: string };

      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the default message if the response is not JSON.
    }

    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

  export function createAiReply(sessionId: string, advisorMessage: string) {
    return request<{ reply: string }>(`/api/sessions/${sessionId}/reply`, {
      method: "POST",
      body: JSON.stringify({ advisorMessage }),
    });
  }

  export function getUsers(options?: { includeInactive?: boolean }) {
  const query = options?.includeInactive ? "?includeInactive=true" : "";
  return request<User[]>(`/api/users${query}`);
}

export function createUser(body: {
  name: string;
  email: string;
  role: User["role"];
  weeklyCallGoal: number;
}) {
  return request<User>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateUser(
  userId: string,
  body: Partial<{
    name: string;
    email: string;
    role: User["role"];
    weeklyCallGoal: number;
    isActive: boolean;
  }>
) {
  return request<User>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

  export function updateWeeklyCallGoal(userId: string, weeklyCallGoal: number) {
    return request<User>(`/api/admin/users/${userId}/weekly-goal`, {
      method: "PATCH",
      body: JSON.stringify({ weeklyCallGoal }),
    });
  }
  export function getPersonas() {
    return request<Persona[]>("/api/personas");
  }

  export function getAdminPersonas() {
    return request<Persona[]>("/api/admin/personas");
  }

  export function createPersona(body: {
    name: string;
    description: string;
    openingLine: string;
    behavioralRules: string;
    primarySkills?: string;
  }) {
    return request<Persona>("/api/admin/personas", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  export function updatePersona(
    personaId: string,
    body: Partial<{
      name: string;
      description: string;
      openingLine: string;
      behavioralRules: string;
      primarySkills: string | null;
      isActive: boolean;
    }>
  ) {
    return request<Persona>(`/api/admin/personas/${personaId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  export function createScenario(
    personaId: string,
    body: {
      title: string;
      vehicle?: string;
      concern?: string;
      difficulty?: string;
      promptNotes?: string;
    }
  ) {
    return request<Scenario>(
      `/api/admin/personas/${personaId}/scenarios`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  export function updateScenario(
    scenarioId: string,
    body: Partial<{
      title: string;
      vehicle: string | null;
      concern: string | null;
      difficulty: string | null;
      promptNotes: string | null;
      isActive: boolean;
    }>
  ) {
    return request<Scenario>(`/api/admin/scenarios/${scenarioId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  export function getScorecardTemplate() {
    return request<ScorecardTemplate>("/api/scorecard-template");
  }

  export function getSessions() {
    return request<Session[]>("/api/sessions");
  }

  export function getAdminResults() {
    return request<Session[]>("/api/admin/results");
  }

  export function getAdminAdvisorResults(userId: string) {
    return request<{ advisor: User; sessions: Session[] }>(
      `/api/admin/advisors/${userId}/results`
    );
  }

  export function getSession(sessionId: string) {
    return request<Session>(`/api/sessions/${sessionId}`);
  }

  export function createSession(body: {
    userId: string;
    personaId: string;
    scenarioId: string;
    channel?: "BROWSER" | "TWILIO";
  }) {
    return request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  export function getTurns(sessionId: string) {
    return request<Turn[]>(`/api/sessions/${sessionId}/turns`);
  }

  export function createTurn(sessionId: string, body: { speaker: string; text: string }) {
    return request<Turn>(`/api/sessions/${sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  export function getScorecard(sessionId: string) {
    return request<ScorecardResult>(`/api/sessions/${sessionId}/scorecard`);
  }

  export function evaluateScorecard(sessionId: string) {
    return request<ScorecardResult>(
      `/api/sessions/${sessionId}/scorecard/evaluate`,
      {
        method: "POST",
      }
    );
  }

  export function endSession(sessionId: string) {
    return request<Session>(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
  }

  export function sessionDate(session: Session): string {
    return session.startedAt ? new Date(session.startedAt).toLocaleString() : "";
  }

  export function sessionTime(session: Session): number {
    return session.startedAt ? new Date(session.startedAt).getTime() : 0;
  }

  export function personaName(session: Session): string {
    return session.persona?.name ?? "Training Call";
  }

