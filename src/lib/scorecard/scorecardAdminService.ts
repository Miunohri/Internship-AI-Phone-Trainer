import { prisma } from "@/lib/prisma";
import {
  ScorecardValidationError,
  type ValidatedScorecardCriterion,
} from "./scorecardValidation";

export async function getScorecardCriteria() {
  const template = await prisma.scorecardTemplate.findFirst({
    where: {
      isActive: true,
    },
    include: {
      criteria: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!template) {
    throw new Error("No active scorecard template found.");
  }

  return template.criteria;
}

export async function saveScorecardCriteria(
  criteria: ValidatedScorecardCriterion[]
) {
  const template = await prisma.scorecardTemplate.findFirst({
    where: {
      isActive: true,
    },
    include: {
      criteria: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!template) {
    throw new Error("No active scorecard template found.");
  }

  const existingById = new Map(
    template.criteria.map((criterion) => [criterion.id, criterion])
  );

  const submittedExistingIds = new Set(
    criteria
      .map((criterion) => criterion.id)
      .filter((id): id is string => id !== null)
  );

  for (const id of submittedExistingIds) {
    if (!existingById.has(id)) {
      throw new ScorecardValidationError(
        "One or more criteria do not belong to the active scorecard."
      );
    }
  }

  const missingCriteria = template.criteria.filter(
    (criterion) => !submittedExistingIds.has(criterion.id)
  );

  if (missingCriteria.length > 0) {
    throw new ScorecardValidationError(
      "Existing criteria cannot be removed. Deactivate criteria that should no longer be used."
    );
  }

  const highestCurrentOrder = template.criteria.reduce(
    (highest, criterion) => Math.max(highest, criterion.sortOrder),
    0
  );

  const temporaryOrderStart =
    highestCurrentOrder + template.criteria.length + criteria.length + 100;

  return prisma.$transaction(async (transaction) => {
    // Move existing criteria temporarily so reordered final positions
    // cannot violate the unique templateId/sortOrder constraint.
    for (const [index, criterion] of template.criteria.entries()) {
      await transaction.scorecardCriterion.update({
        where: {
          id: criterion.id,
        },
        data: {
          sortOrder: temporaryOrderStart + index,
        },
      });
    }

    for (const [index, criterion] of criteria.entries()) {
      if (criterion.id) {
        await transaction.scorecardCriterion.update({
          where: {
            id: criterion.id,
          },
          data: {
            name: criterion.name,
            description: criterion.description,
            maxScore: criterion.maxScore,
            weight: criterion.weight,
            sortOrder: index,
            isActive: criterion.isActive,
          },
        });
      } else {
        await transaction.scorecardCriterion.create({
          data: {
            templateId: template.id,
            name: criterion.name,
            description: criterion.description,
            maxScore: criterion.maxScore,
            weight: criterion.weight,
            sortOrder: index,
            isActive: criterion.isActive,
          },
        });
      }
    }

    return transaction.scorecardCriterion.findMany({
      where: {
        templateId: template.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });
  });
}