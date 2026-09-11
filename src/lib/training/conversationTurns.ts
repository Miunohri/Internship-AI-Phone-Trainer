import { prisma } from "@/lib/prisma";
import type { Speaker } from "@/types/training";

const MAX_SEQUENCE_RETRIES = 4;

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function createConversationTurn(
  sessionId: string,
  speaker: Speaker,
  text: string
) {
  for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt++) {
    const latestTurn = await prisma.conversationTurn.findFirst({
      where: { sessionId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });

    const nextSequence = (latestTurn?.sequence ?? 0) + 1;

    try {
      return await prisma.conversationTurn.create({
        data: {
          sessionId,
          speaker,
          text,
          sequence: nextSequence,
        },
      });
    } catch (error) {
      if (
        isUniqueConstraintError(error) &&
        attempt < MAX_SEQUENCE_RETRIES - 1
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not allocate a transcript sequence number");
}
