import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

const allowedChannels = ["BROWSER", "TWILIO"] as const;

type SessionChannel = (typeof allowedChannels)[number];

type StartSessionBody = {
  userId?: unknown;
  personaId?: unknown;
  scenarioId?: unknown;
  channel?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSessionChannel(value: unknown): value is SessionChannel {
  return (
    typeof value === "string" &&
    allowedChannels.includes(value as SessionChannel)
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();

    if (auth.response) {
      return auth.response;
    }

    let body: StartSessionBody;

    try {
      body = (await request.json()) as StartSessionBody;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    if (
      !isNonEmptyString(body.personaId) ||
      !isNonEmptyString(body.scenarioId)
    ) {
      return NextResponse.json(
        { error: "personaId and scenarioId are required" },
        { status: 400 }
      );
    }

    if (body.userId !== undefined) {
      if (!isNonEmptyString(body.userId)) {
        return NextResponse.json(
          { error: "userId must be a non-empty string when provided" },
          { status: 400 }
        );
      }

      if (body.userId.trim() !== auth.user.id) {
        return NextResponse.json(
          { error: "You cannot create a training session for another user" },
          { status: 403 }
        );
      }
    }

    if (
      body.channel !== undefined &&
      !isSessionChannel(body.channel)
    ) {
      return NextResponse.json(
        { error: "channel must be BROWSER or TWILIO" },
        { status: 400 }
      );
    }

    const userId = auth.user.id;
    const personaId = body.personaId.trim();
    const scenarioId = body.scenarioId.trim();

    const [persona, scenario] = await Promise.all([
      prisma.persona.findUnique({
        where: { id: personaId },
        select: {
          id: true,
          isActive: true,
        },
      }),
      prisma.scenario.findUnique({
        where: { id: scenarioId },
        select: {
          id: true,
          personaId: true,
          isActive: true,
        },
      }),
    ]);

    if (!persona) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    if (!scenario) {
      return NextResponse.json(
        { error: "Scenario not found" },
        { status: 404 }
      );
    }

    if (!persona.isActive) {
      return NextResponse.json(
        { error: "Inactive personas cannot be used for new training sessions" },
        { status: 409 }
      );
    }

    if (!scenario.isActive) {
      return NextResponse.json(
        { error: "Inactive scenarios cannot be used for new training sessions" },
        { status: 409 }
      );
    }

    if (scenario.personaId !== personaId) {
      return NextResponse.json(
        { error: "The selected scenario does not belong to the selected persona" },
        { status: 409 }
      );
    }

    const session = await prisma.trainingSession.create({
      data: {
        userId,
        personaId,
        scenarioId,
        channel: body.channel ?? "BROWSER",
      },
      include: {
        persona: true,
        scenario: true,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Failed to create training session:", error);

    return NextResponse.json(
      { error: "Failed to create training session" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const auth = await requireApiUser();

    if (auth.response) {
      return auth.response;
    }

    const sessions = await prisma.trainingSession.findMany({
      where: {
        userId: auth.user.id,
      },
      orderBy: {
        startedAt: "desc",
      },
      include: {
        user: true,
        persona: true,
        scenario: true,
        scorecardResult: true,
      },
    });

    return NextResponse.json(sessions, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch training sessions:", error);

    return NextResponse.json(
      { error: "Failed to fetch training sessions" },
      { status: 500 }
    );
  }
}
