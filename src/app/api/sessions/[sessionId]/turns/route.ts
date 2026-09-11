import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionAccess } from "@/lib/sessionAuth";
import { createConversationTurn } from "@/lib/training/conversationTurns";
import type { Speaker } from "@/types/training";

const allowedSpeakers: Speaker[] = [
  "ADVISOR",
  "AI_CUSTOMER",
  "SYSTEM",
];

const MAX_TURN_LENGTH = 10000;

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type TurnRequestBody = {
  speaker?: unknown;
  text?: unknown;
};

function isSpeaker(value: unknown): value is Speaker {
  return (
    typeof value === "string" &&
    allowedSpeakers.includes(value as Speaker)
  );
}

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

    let body: TurnRequestBody;

    try {
      body = (await request.json()) as TurnRequestBody;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    if (!isSpeaker(body.speaker)) {
      return NextResponse.json(
        { error: "speaker must be ADVISOR, AI_CUSTOMER, or SYSTEM" },
        { status: 400 }
      );
    }

    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const text = body.text.trim();

    if (text.length > MAX_TURN_LENGTH) {
      return NextResponse.json(
        {
          error: `text must be ${MAX_TURN_LENGTH} characters or fewer`,
        },
        { status: 400 }
      );
    }

    if (access.session.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot add transcript turns to a completed session" },
        { status: 409 }
      );
    }

    const turn = await createConversationTurn(
      sessionId,
      body.speaker,
      text
    );

    return NextResponse.json(turn, { status: 201 });
  } catch (error) {
    console.error("Failed to create conversation turn:", error);

    return NextResponse.json(
      { error: "Failed to create conversation turn" },
      { status: 500 }
    );
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const access = await requireSessionAccess(sessionId, {
      allowManagerRead: true,
    });

    if (access.response) {
      return access.response;
    }

    const turns = await prisma.conversationTurn.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
    });

    return NextResponse.json(turns, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch conversation turns:", error);

    return NextResponse.json(
      { error: "Failed to fetch conversation turns" },
      { status: 500 }
    );
  }
}
