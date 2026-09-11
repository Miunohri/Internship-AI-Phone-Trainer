import OpenAI from "openai";
import { buildMessages } from "./prompts";
import type {
  ConversationTurnRecord,
  PersonaWithScenarios,
  ScenarioRecord,
} from "./types";

export class AIGenerationError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AIGenerationError";
    this.cause = cause;
  }
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type GenerateReplyParams = {
  persona: PersonaWithScenarios;
  scenario: ScenarioRecord;
  transcript: ConversationTurnRecord[];
  advisorMessage: string;
};

export async function generateCustomerReply({
  persona,
  scenario,
  transcript,
  advisorMessage,
}: GenerateReplyParams): Promise<string> {
  const { system, messages } = buildMessages(
    persona,
    scenario,
    transcript,
    advisorMessage
  );

  try {
    const completion = await client.chat.completions.create({
  model: process.env.OPENAI_REPLY_MODEL ?? "gpt-4o-mini",
  temperature: 0.8,
  max_tokens: 300,
  messages: [{ role: "system", content: system }, ...messages],
});

    const reply = completion.choices[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("OpenAI returned an empty response");
    }

    return reply;
  } catch (err) {
    console.error("[generateCustomerReply] OpenAI call failed:", err);
    throw new AIGenerationError("Failed to generate AI customer reply", err);
  }
}