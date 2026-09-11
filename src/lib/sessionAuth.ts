import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

type SessionAccessOptions = {
  allowManagerRead?: boolean;
};

export async function requireSessionAccess(
  sessionId: string,
  options: SessionAccessOptions = {}
) {
  const auth = await requireApiUser();

  if (auth.response) {
    return {
      user: null,
      session: null,
      response: auth.response,
    };
  }

  const session = await prisma.trainingSession.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  });

  if (!session) {
    return {
      user: null,
      session: null,
      response: NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      ),
    };
  }

  const isOwner = session.userId === auth.user.id;
  const hasManagerAccess =
    options.allowManagerRead === true &&
    (auth.user.role === "MANAGER" || auth.user.role === "ADMIN");

  if (!isOwner && !hasManagerAccess) {
    return {
      user: null,
      session: null,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return {
    user: auth.user,
    session,
    response: null,
  };
}
