import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionAccess } from "@/lib/sessionAuth";
import {
  AIGenerationError,
  generateCustomerReply,
} from "@/lib/ai/openai-provider";
import type { ConversationTurnRecord } from "@/lib/ai/types";
import { createConversationTurn } from "@/lib/training/conversationTurns";

const MAX_ADVISOR_MESSAGE_LENGTH = 10000;

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type ReplyRequest = {
  advisorMessage?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const access = await requireSessionAccess(sessionId);

    if (access.response) {
      return access.response;
    }

    let body: ReplyRequest;

    try {
      body = (await request.json()) as ReplyRequest;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    if (
      typeof body.advisorMessage !== "string" ||
      !body.advisorMessage.trim()
    ) {
      return NextResponse.json(
        { error: "advisorMessage is required" },
        { status: 400 }
      );
    }

    const advisorMessage = body.advisorMessage.trim();

    if (advisorMessage.length > MAX_ADVISOR_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `advisorMessage must be ${MAX_ADVISOR_MESSAGE_LENGTH} characters or fewer`,
        },
        { status: 400 }
      );
    }

    if (access.session.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot reply to a completed training session" },
        { status: 409 }
      );
    }

    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        persona: {
          include: {
            scenarios: true,
          },
        },
        scenario: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Training session not found" },
        { status: 404 }
      );
    }

    const existingTurns = await prisma.conversationTurn.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
    });

    const transcript: ConversationTurnRecord[] = existingTurns.map(
      (turn) => ({
        speaker: turn.speaker,
        text: turn.text,
        sequence: turn.sequence,
      })
    );

    await createConversationTurn(
      sessionId,
      "ADVISOR",
      advisorMessage
    );

    const reply = await generateCustomerReply({
      persona: session.persona,
      scenario: session.scenario,
      transcript,
      advisorMessage,
    });

    await createConversationTurn(
      sessionId,
      "AI_CUSTOMER",
      reply
    );

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    if (error instanceof AIGenerationError) {
      return NextResponse.json(
        {
          error:
            "The AI customer is temporarily unavailable. Please try again.",
        },
        { status: 502 }
      );
    }

    console.error("Failed to generate AI reply:", error);

    return NextResponse.json(
      { error: "Failed to generate AI reply" },
      { status: 500 }
    );
  }
}
