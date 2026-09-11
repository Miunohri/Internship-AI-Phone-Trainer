import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionAccess } from "@/lib/sessionAuth";
import { evaluateTranscript } from "@/lib/scorecard/aiEvaluator";
import {
  normalizeScorecardEvaluation,
  ScorecardEvaluationError,
} from "@/lib/scorecard/normalizeScorecardEvaluation";
import { getActiveScorecardTemplate } from "@/lib/scorecard/scorecardService";
import { saveScorecardResult } from "@/lib/scorecard/saveScorecardResult";
import type { Speaker } from "@/types/training";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

function formatSpeaker(speaker: Speaker) {
  if (speaker === "ADVISOR") {
    return "ADVISOR";
  }

  if (speaker === "AI_CUSTOMER") {
    return "CUSTOMER";
  }

  return "SYSTEM";
}

export async function POST(_request: Request, context: RouteContext) {
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

    const existingResult = await prisma.scorecardResult.findUnique({
      where: { sessionId },
      include: {
        template: true,
        criterionResults: {
          include: {
            criterion: true,
          },
        },
      },
    });

    if (existingResult) {
      return NextResponse.json(existingResult);
    }

    const session = await prisma.trainingSession.findUnique({
      where: {
        id: sessionId,
      },
      include: {
        conversationTurns: {
          orderBy: {
            sequence: "asc",
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Training session not found" },
        { status: 404 }
      );
    }

    if (session.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Training session must be completed before scoring" },
        { status: 409 }
      );
    }

    if (session.conversationTurns.length === 0) {
      return NextResponse.json(
        { error: "Cannot score a session with no transcript turns" },
        { status: 400 }
      );
    }

    const template = await getActiveScorecardTemplate();

    if (!template) {
      return NextResponse.json(
        { error: "No active scorecard template found" },
        { status: 404 }
      );
    }

    if (template.criteria.length === 0) {
      return NextResponse.json(
        { error: "The active scorecard has no active criteria" },
        { status: 400 }
      );
    }

    const transcript = session.conversationTurns
      .map((turn) => `${formatSpeaker(turn.speaker)}: ${turn.text}`)
      .join("\n\n");

    const evaluation: unknown = await evaluateTranscript(
      transcript,
      template
    );

    const scorecardBody = normalizeScorecardEvaluation(
      evaluation,
      template,
      sessionId
    );

    const savedResult = await saveScorecardResult(
      sessionId,
      scorecardBody
    );

    return NextResponse.json(savedResult, {
      status: 201,
    });
  } catch (error) {
    if (error instanceof ScorecardEvaluationError) {
      console.error("Invalid AI scorecard response:", error.message);

      return NextResponse.json(
        {
          error: "The AI returned an invalid scorecard evaluation.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    console.error("Failed to evaluate scorecard:", error);

    return NextResponse.json(
      {
        error: "Failed to evaluate scorecard",
      },
      { status: 500 }
    );
  }
}
