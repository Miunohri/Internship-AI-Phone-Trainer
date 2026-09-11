import type { ScorecardServiceResponse } from "@/types/training";

export class ScorecardEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScorecardEvaluationError";
  }
}

type ScorecardTemplateForEvaluation = {
  id: string;
  criteria: {
    id: string;
    name: string;
    maxScore: number;
    weight: number;
    sortOrder: number;
  }[];
};

function requireObject(
  value: unknown,
  fieldName: string
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScorecardEvaluationError(`${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireString(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new ScorecardEvaluationError(`${fieldName} must be text.`);
  }

  const text = value.trim();

  if (text.length === 0 || text.length > maximumLength) {
    throw new ScorecardEvaluationError(
      `${fieldName} must be between 1 and ${maximumLength} characters.`
    );
  }

  return text;
}

function optionalString(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return requireString(value, fieldName, maximumLength);
}

function requireScore(
  value: unknown,
  fieldName: string,
  maximumScore: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw new ScorecardEvaluationError(
      `${fieldName} must be a whole number.`
    );
  }

  if (value < 1 || value > maximumScore) {
    throw new ScorecardEvaluationError(
      `${fieldName} must be between 1 and ${maximumScore}.`
    );
  }

  return value;
}

export function normalizeScorecardEvaluation(
  value: unknown,
  template: ScorecardTemplateForEvaluation,
  sessionId: string
): ScorecardServiceResponse {
  const evaluation = requireObject(value, "Scorecard evaluation");

  if (template.criteria.length === 0) {
    throw new ScorecardEvaluationError(
      "The active scorecard has no active criteria."
    );
  }

  if (!Array.isArray(evaluation.criteria)) {
    throw new ScorecardEvaluationError(
      "Scorecard evaluation criteria must be an array."
    );
  }

  if (evaluation.criteria.length !== template.criteria.length) {
    throw new ScorecardEvaluationError(
      "The scorecard evaluation did not return exactly one result for each active criterion."
    );
  }

  const templateById = new Map(
    template.criteria.map((criterion) => [criterion.id, criterion])
  );

  const submittedById = new Map<
    string,
    {
      score: number;
      feedback: string;
      evidence?: string;
    }
  >();

  evaluation.criteria.forEach((item, index) => {
    const result = requireObject(
      item,
      `Criterion result ${index + 1}`
    );

    const criterionId = requireString(
      result.criterionId,
      `Criterion result ${index + 1} ID`,
      200
    );

    const configuredCriterion = templateById.get(criterionId);

    if (!configuredCriterion) {
      throw new ScorecardEvaluationError(
        `Criterion result ${index + 1} contains an unknown criterion ID.`
      );
    }

    if (submittedById.has(criterionId)) {
      throw new ScorecardEvaluationError(
        "The scorecard evaluation returned a criterion more than once."
      );
    }

    submittedById.set(criterionId, {
      score: requireScore(
        result.score,
        `${configuredCriterion.name} score`,
        configuredCriterion.maxScore
      ),
      feedback: requireString(
        result.feedback,
        `${configuredCriterion.name} feedback`,
        4000
      ),
      evidence: optionalString(
        result.evidence,
        `${configuredCriterion.name} evidence`,
        4000
      ),
    });
  });

  const orderedCriteria = [...template.criteria].sort(
    (first, second) => first.sortOrder - second.sortOrder
  );

  const normalizedCriteria = orderedCriteria.map((criterion) => {
    const submitted = submittedById.get(criterion.id);

    if (!submitted) {
      throw new ScorecardEvaluationError(
        `The scorecard evaluation is missing the "${criterion.name}" criterion.`
      );
    }

    return {
      criterionId: criterion.id,
      name: criterion.name,
      score: submitted.score,
      maxScore: criterion.maxScore,
      weight: criterion.weight,
      sortOrder: criterion.sortOrder,
      feedback: submitted.feedback,
      evidence: submitted.evidence,
    };
  });

  const totalScore = normalizedCriteria.reduce(
    (total, criterion) =>
      total + criterion.score * criterion.weight,
    0
  );

  const maxScore = normalizedCriteria.reduce(
    (total, criterion) =>
      total + criterion.maxScore * criterion.weight,
    0
  );

  return {
    schemaVersion: "1.0",
    sessionId,
    scorecardTemplateId: template.id,
    totalScore,
    maxScore,
    summary: requireString(
      evaluation.summary,
      "Scorecard summary",
      5000
    ),
    actionPlan: requireString(
      evaluation.actionPlan,
      "Scorecard action plan",
      10000
    ),
    criteria: normalizedCriteria,
  };
}