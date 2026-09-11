import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireApiUser(["MANAGER", "ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const { userId } = await context.params;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const advisor = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!advisor) {
      return NextResponse.json(
        { error: "Advisor not found" },
        { status: 404 }
      );
    }

    const sessions = await prisma.trainingSession.findMany({
      where: { userId },
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

    return NextResponse.json(
      { advisor, sessions },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch advisor admin results:", error);

    return NextResponse.json(
      { error: "Failed to fetch advisor admin results" },
      { status: 500 }
    );
  }
}
