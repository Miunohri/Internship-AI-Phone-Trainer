import { prisma } from "@/lib/prisma";
import type { ScorecardServiceResponse } from "@/types/training";

function criterionResultData(
  criterion: ScorecardServiceResponse["criteria"][number]
) {
  return {
    criterionId: criterion.criterionId,
    score: criterion.score,
    feedback: criterion.feedback,
    evidence: criterion.evidence,
    criterionNameSnapshot: criterion.name,
    criterionMaxSnapshot: criterion.maxScore,
    criterionWeightSnapshot: criterion.weight,
    criterionOrderSnapshot: criterion.sortOrder,
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function getResult(sessionId: string) {
  return prisma.scorecardResult.findUnique({
    where: { sessionId },
    include: {
      template: true,
      criterionResults: {
        include: {
          criterion: true,
        },
      },
    },
  });
}

export async function saveScorecardResult(
  sessionId: string,
  body: ScorecardServiceResponse
) {
  const existingResult = await getResult(sessionId);

  if (existingResult) {
    return existingResult;
  }

  try {
    return await prisma.scorecardResult.create({
      data: {
        sessionId,
        templateId: body.scorecardTemplateId,
        totalScore: body.totalScore,
        maxScore: body.maxScore,
        summary: body.summary,
        actionPlan: body.actionPlan,
        rawAiResponse: JSON.parse(JSON.stringify(body)),
        criterionResults: {
          create: body.criteria.map(criterionResultData),
        },
      },
      include: {
        template: true,
        criterionResults: {
          include: {
            criterion: true,
          },
        },
      },
    });
  } catch (error) {
    // Two evaluation requests could theoretically finish at nearly the
    // same time. The database's unique sessionId constraint decides which
    // result wins. Return that stored result rather than overwriting it.
    if (isUniqueConstraintError(error)) {
      const storedResult = await getResult(sessionId);

      if (storedResult) {
        return storedResult;
      }
    }

    throw error;
  }
}
