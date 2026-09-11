import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  isPrismaErrorCode,
  readJsonObject,
  UserValidationError,
  validateWeeklyCallGoal,
} from "@/lib/admin/userValidation";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requireApiUser(["MANAGER", "ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const { userId } = await context.params;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required." },
        { status: 400 }
      );
    }

    const body = await readJsonObject(request);
    const weeklyCallGoal = validateWeeklyCallGoal(
      body.weeklyCallGoal
    );

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        weeklyCallGoal,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        weeklyCallGoal: true,
        isActive: true,
      },
    });

    return NextResponse.json(user, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UserValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    console.error("Failed to update weekly call goal:", error);

    return NextResponse.json(
      { error: "Failed to update weekly call goal." },
      { status: 500 }
    );
  }
}
