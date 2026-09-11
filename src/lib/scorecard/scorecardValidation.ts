export class ScorecardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScorecardValidationError";
  }
}

export type ValidatedScorecardCriterion = {
  id: string | null;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
  isActive: boolean;
};

function requireObject(
  value: unknown,
  position: number
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScorecardValidationError(
      `Criterion ${position + 1} must be an object.`
    );
  }

  return value as Record<string, unknown>;
}

function validateId(value: unknown, position: number): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ScorecardValidationError(
      `Criterion ${position + 1} has an invalid ID.`
    );
  }

  return value.trim();
}

function validateText(
  value: unknown,
  fieldName: string,
  minimumLength: number,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new ScorecardValidationError(`${fieldName} must be text.`);
  }

  const text = value.trim();

  if (text.length < minimumLength || text.length > maximumLength) {
    throw new ScorecardValidationError(
      `${fieldName} must be between ${minimumLength} and ${maximumLength} characters.`
    );
  }

  return text;
}

function validateInteger(
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw new ScorecardValidationError(
      `${fieldName} must be a whole number.`
    );
  }

  if (value < minimum || value > maximum) {
    throw new ScorecardValidationError(
      `${fieldName} must be between ${minimum} and ${maximum}.`
    );
  }

  return value;
}

function validateBoolean(
  value: unknown,
  fieldName: string
): boolean {
  if (typeof value !== "boolean") {
    throw new ScorecardValidationError(
      `${fieldName} must be true or false.`
    );
  }

  return value;
}

export function validateScorecardCriteria(
  value: unknown
): ValidatedScorecardCriterion[] {
  if (!Array.isArray(value)) {
    throw new ScorecardValidationError("Criteria must be an array.");
  }

  if (value.length === 0) {
    throw new ScorecardValidationError(
      "The scorecard must contain at least one criterion."
    );
  }

  if (value.length > 50) {
    throw new ScorecardValidationError(
      "The scorecard cannot contain more than 50 criteria."
    );
  }

  const criteria = value.map((item, position) => {
    const criterion = requireObject(item, position);

    return {
      id: validateId(criterion.id, position),
      name: validateText(
        criterion.name,
        `Criterion ${position + 1} name`,
        1,
        100
      ),
      description: validateText(
        criterion.description,
        `Criterion ${position + 1} description`,
        1,
        500
      ),
      maxScore: validateInteger(
        criterion.maxScore,
        `Criterion ${position + 1} maximum score`,
        1,
        100
      ),
      weight: validateInteger(
        criterion.weight,
        `Criterion ${position + 1} weight`,
        1,
        100
      ),
      isActive: validateBoolean(
        criterion.isActive,
        `Criterion ${position + 1} active status`
      ),
    };
  });

  const existingIds = criteria
    .map((criterion) => criterion.id)
    .filter((id): id is string => id !== null);

  if (new Set(existingIds).size !== existingIds.length) {
    throw new ScorecardValidationError(
      "Each existing criterion may appear only once."
    );
  }

  if (!criteria.some((criterion) => criterion.isActive)) {
    throw new ScorecardValidationError(
      "The scorecard must contain at least one active criterion."
    );
  }

  return criteria;
}
