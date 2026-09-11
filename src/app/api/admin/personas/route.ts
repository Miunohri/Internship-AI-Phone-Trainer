import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  isPrismaErrorCode,
  PersonaScenarioValidationError,
  readJsonObject,
  validatePersonaCreate,
} from "@/lib/admin/personaScenarioValidation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireApiUser(["ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const personas = await prisma.persona.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        scenarios: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json(personas, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load admin personas:", error);

    return NextResponse.json(
      { error: "Failed to load personas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(["ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const body = await readJsonObject(request);
    const data = validatePersonaCreate(body);

    const persona = await prisma.persona.create({
      data: {
        ...data,
        isActive: true,
      },
      include: {
        scenarios: true,
      },
    });

    return NextResponse.json(persona, {
      status: 201,
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

    console.error("Failed to create persona:", error);

    return NextResponse.json(
      { error: "Failed to create persona." },
      { status: 500 }
    );
  }
}
