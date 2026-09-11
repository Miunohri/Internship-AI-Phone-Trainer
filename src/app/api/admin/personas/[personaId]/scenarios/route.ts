import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  PersonaScenarioValidationError,
  readJsonObject,
  validateScenarioCreate,
} from "@/lib/admin/personaScenarioValidation";

type RouteContext = {
  params: Promise<{
    personaId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requireApiUser(["ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const { personaId } = await context.params;

    if (!personaId) {
      return NextResponse.json(
        { error: "personaId is required." },
        { status: 400 }
      );
    }

    const body = await readJsonObject(request);
    const data = validateScenarioCreate(body);

    const persona = await prisma.persona.findUnique({
      where: {
        id: personaId,
      },
      select: {
        id: true,
      },
    });

    if (!persona) {
      return NextResponse.json(
        { error: "Persona not found." },
        { status: 404 }
      );
    }

    const scenario = await prisma.scenario.create({
      data: {
        personaId,
        title: data.title,
        type: "INBOUND",
        vehicle: data.vehicle,
        concern: data.concern,
        difficulty: data.difficulty,
        promptNotes: data.promptNotes,
        isActive: true,
      },
    });

    return NextResponse.json(scenario, {
      status: 201,
    });
  } catch (error) {
    if (error instanceof PersonaScenarioValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("Failed to create scenario:", error);

    return NextResponse.json(
      { error: "Failed to create scenario." },
      { status: 500 }
    );
  }
}
