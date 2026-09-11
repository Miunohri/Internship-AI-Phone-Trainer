import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requireApiUser(["MANAGER", "ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const sessions = await prisma.trainingSession.findMany({
      orderBy: {
        startedAt: "desc",
      },
      include: {
        user: true,
        persona: true,
        scenario: true,
        scorecardResult: {
          include: {
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

    return NextResponse.json(sessions, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin results:", error);

    return NextResponse.json(
      { error: "Failed to fetch admin results" },
      { status: 500 }
    );
  }
}
