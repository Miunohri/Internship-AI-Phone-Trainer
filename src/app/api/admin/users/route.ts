import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  isPrismaErrorCode,
  readJsonObject,
  UserValidationError,
  validateUserCreate,
} from "@/lib/admin/userValidation";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(["ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const body = await readJsonObject(request);
    const data = validateUserCreate(body);

    const user = await prisma.user.create({
      data: {
        ...data,
        isActive: true,
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
      status: 201,
    });
  } catch (error) {
    if (error instanceof UserValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 }
      );
    }

    console.error("Failed to create user:", error);

    return NextResponse.json(
      { error: "Failed to create user." },
      { status: 500 }
    );
  }
}
