import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionAccess } from "@/lib/sessionAuth";

const allowedStatuses = [
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

type PatchStatus = (typeof allowedStatuses)[number];

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type PatchBody = {
  status?: unknown;
};

function isPatchStatus(value: unknown): value is PatchStatus {
  return (
    typeof value === "string" &&
    allowedStatuses.includes(value as PatchStatus)
  );
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

    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
        persona: true,
        scenario: true,
        conversationTurns: {
          orderBy: {
            sequence: "asc",
          },
        },
        scorecardResult: {
          include: {
            template: true,
            criterionResults: {
              include: {
                criterion: true,
              },
              orderBy: {
                criterion: {
                  sortOrder: "asc",
                },
              },
            },
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

    return NextResponse.json(session, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch training session:", error);

    return NextResponse.json(
      { error: "Failed to fetch training session" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    let body: PatchBody;

    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    if (!isPatchStatus(body.status)) {
      return NextResponse.json(
        {
          error:
            "status must be IN_PROGRESS, COMPLETED, or CANCELLED",
        },
        { status: 400 }
      );
    }

    const existingSession =
      await prisma.trainingSession.findUnique({
        where: { id: sessionId },
      });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Training session not found" },
        { status: 404 }
      );
    }

    const isTerminal =
      existingSession.status === "COMPLETED" ||
      existingSession.status === "CANCELLED";

    if (
      isTerminal &&
      body.status !== existingSession.status
    ) {
      return NextResponse.json(
        {
          error:
            "Completed or cancelled training sessions cannot be reopened or changed",
        },
        { status: 409 }
      );
    }

    const data: {
      status: PatchStatus;
      endedAt?: Date | null;
    } = {
      status: body.status,
    };

    if (
      body.status === "COMPLETED" ||
      body.status === "CANCELLED"
    ) {
      data.endedAt =
        existingSession.endedAt ?? new Date();
    }

    if (body.status === "IN_PROGRESS") {
      data.endedAt = null;
    }

    const updatedSession =
      await prisma.trainingSession.update({
        where: { id: sessionId },
        data,
        include: {
          user: true,
          persona: true,
          scenario: true,
          conversationTurns: {
            orderBy: {
              sequence: "asc",
            },
          },
          scorecardResult: true,
        },
      });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Failed to update training session:", error);

    return NextResponse.json(
      { error: "Failed to update training session" },
      { status: 500 }
    );
  }
}
