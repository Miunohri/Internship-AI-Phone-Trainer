import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requireApiUser();

    if (auth.response) {
      return auth.response;
    }

    const template = await prisma.scorecardTemplate.findFirst({
      where: {
        isActive: true,
      },
      include: {
        criteria: {
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "No active scorecard template found" },
        { status: 404 }
      );
    }

    return NextResponse.json(template, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch scorecard template:", error);

    return NextResponse.json(
      { error: "Failed to fetch scorecard template" },
      { status: 500 }
    );
  }
}
