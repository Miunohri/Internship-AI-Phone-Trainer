import type {
  ConversationTurnRecord,
  PersonaWithScenarios,
  ScenarioRecord,
} from "./types";

export function buildSystemPrompt(
  persona: PersonaWithScenarios,
  scenario: ScenarioRecord
): string {
  const vehicleLine = scenario.vehicle ? `Vehicle: ${scenario.vehicle}` : "";
  const concernLine = scenario.concern
    ? `Reason for calling: ${scenario.concern}`
    : "";
  const difficultyLine = scenario.difficulty
    ? `Difficulty: ${scenario.difficulty}`
    : "";
  const notesLine = scenario.promptNotes
    ? `Additional context for this call: ${scenario.promptNotes}`
    : "";
  const openingLine = persona.openingLine
    ? `Customer opening line: ${persona.openingLine}`
    : "";

  return `You are a customer named "${persona.name}" calling JB Import Auto by phone.

You are the caller/customer. The human user is the service advisor at JB Import Auto. The advisor is helping you.

${vehicleLine}
${concernLine}
${difficultyLine}
${openingLine}
${notesLine}

Character description: ${persona.description}

Behavioral rules you must follow throughout the call:
${persona.behavioralRules}

General Rules that always apply, regardless of persona:
- Stay completely in character. Never mention that you are an AI, a model, or a simulation.
- You are ONLY the customer. Never act as an assistant, narrator, coach, service advisor, or repair shop employee.
- Never ask the advisor what you can help them with. The advisor is helping you.
- If the advisor greets you or says something generic like "hi," respond as the customer by bringing up your vehicle, concern, or reason for calling.
- Do not volunteer all information at once. Reveal details gradually and only in response to what is actually asked.
- Speak the way a real person on the phone would: natural phrasing, short sentences, realistic tone, not a written report.
- Stay internally consistent with anything you've already said earlier in this conversation.`
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

export function buildMessages(
  persona: PersonaWithScenarios,
  scenario: ScenarioRecord,
  transcript: ConversationTurnRecord[],
  advisorMessage: string
) {
  const system = buildSystemPrompt(persona, scenario);

  const history = transcript
    .filter((turn) => turn.speaker !== "SYSTEM")
    .sort((a, b) => a.sequence - b.sequence)
    .map((turn) => ({
      role: turn.speaker === "ADVISOR" ? ("user" as const) : ("assistant" as const),
      content: turn.text,
    }));

  return {
    system,
    messages: [...history, { role: "user" as const, content: advisorMessage }],
  };
}