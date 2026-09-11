import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionAccess } from "@/lib/sessionAuth";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

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

    const result = await prisma.scorecardResult.findUnique({
      where: { sessionId },
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
    });

    if (!result) {
      return NextResponse.json(
        { error: "Scorecard result not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch scorecard result:", error);

    return NextResponse.json(
      { error: "Failed to fetch scorecard result" },
      { status: 500 }
    );
  }
}
