import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  isPrismaErrorCode,
  PersonaScenarioValidationError,
  readJsonObject,
  validatePersonaPatch,
} from "@/lib/admin/personaScenarioValidation";

type RouteContext = {
  params: Promise<{
    personaId: string;
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

    const { personaId } = await context.params;

    if (!personaId) {
      return NextResponse.json(
        { error: "personaId is required." },
        { status: 400 }
      );
    }

    const body = await readJsonObject(request);
    const data = validatePersonaPatch(body);

    const persona = await prisma.persona.update({
      where: {
        id: personaId,
      },
      data,
      include: {
        scenarios: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json(persona, {
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

    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "A persona with that name already exists." },
        { status: 409 }
      );
    }

    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json(
        { error: "Persona not found." },
        { status: 404 }
      );
    }

    console.error("Failed to update persona:", error);

    return NextResponse.json(
      { error: "Failed to update persona." },
      { status: 500 }
    );
  }
}
