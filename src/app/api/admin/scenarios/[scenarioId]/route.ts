import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  isPrismaErrorCode,
  PersonaScenarioValidationError,
  readJsonObject,
  validateScenarioPatch,
} from "@/lib/admin/personaScenarioValidation";

type RouteContext = {
  params: Promise<{
    scenarioId: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requireApiUser(["ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const { scenarioId } = await context.params;

    if (!scenarioId) {
      return NextResponse.json(
        { error: "scenarioId is required." },
        { status: 400 }
      );
    }

    const body = await readJsonObject(request);
    const data = validateScenarioPatch(body);

    const scenario = await prisma.scenario.update({
      where: {
        id: scenarioId,
      },
      data,
    });

    return NextResponse.json(scenario, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PersonaScenarioValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json(
        { error: "Scenario not found." },
        { status: 404 }
      );
    }

    console.error("Failed to update scenario:", error);

    return NextResponse.json(
      { error: "Failed to update scenario." },
      { status: 500 }
    );
  }
}
