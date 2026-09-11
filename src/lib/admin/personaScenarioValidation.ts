export class PersonaScenarioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonaScenarioValidationError";
  }
}

export function isPrismaErrorCode(
  error: unknown,
  code: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown>> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    throw new PersonaScenarioValidationError(
      "Request body must contain valid JSON."
    );
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PersonaScenarioValidationError(
      "Request body must be an object."
    );
  }

  return value as Record<string, unknown>;
}

function requiredText(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new PersonaScenarioValidationError(
      `${fieldName} must be text.`
    );
  }

  const text = value.trim();

  if (text.length === 0) {
    throw new PersonaScenarioValidationError(
      `${fieldName} is required.`
    );
  }

  if (text.length > maximumLength) {
    throw new PersonaScenarioValidationError(
      `${fieldName} cannot exceed ${maximumLength} characters.`
    );
  }

  return text;
}

function optionalText(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new PersonaScenarioValidationError(
      `${fieldName} must be text or blank.`
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maximumLength) {
    throw new PersonaScenarioValidationError(
      `${fieldName} cannot exceed ${maximumLength} characters.`
    );
  }

  return text;
}

function booleanValue(
  value: unknown,
  fieldName: string
): boolean {
  if (typeof value !== "boolean") {
    throw new PersonaScenarioValidationError(
      `${fieldName} must be true or false.`
    );
  }

  return value;
}

export type PersonaCreateInput = {
  name: string;
  description: string;
  openingLine: string;
  behavioralRules: string;
  primarySkills: string | null;
};

export type PersonaPatchInput = Partial<
  PersonaCreateInput & {
    isActive: boolean;
  }
>;

export type ScenarioCreateInput = {
  title: string;
  vehicle: string | null;
  concern: string | null;
  difficulty: string | null;
  promptNotes: string | null;
};

export type ScenarioPatchInput = Partial<
  ScenarioCreateInput & {
    isActive: boolean;
  }
>;

export function validatePersonaCreate(
  body: Record<string, unknown>
): PersonaCreateInput {
  return {
    name: requiredText(body.name, "Name", 100),
    description: requiredText(body.description, "Description", 1000),
    openingLine: requiredText(body.openingLine, "Opening line", 1000),
    behavioralRules: requiredText(
      body.behavioralRules,
      "Behavioral rules",
      5000
    ),
    primarySkills: optionalText(
      body.primarySkills,
      "Primary skills",
      1000
    ),
  };
}

export function validatePersonaPatch(
  body: Record<string, unknown>
): PersonaPatchInput {
  const data: PersonaPatchInput = {};

  if ("name" in body) {
    data.name = requiredText(body.name, "Name", 100);
  }

  if ("description" in body) {
    data.description = requiredText(
      body.description,
      "Description",
      1000
    );
  }

  if ("openingLine" in body) {
    data.openingLine = requiredText(
      body.openingLine,
      "Opening line",
      1000
    );
  }

  if ("behavioralRules" in body) {
    data.behavioralRules = requiredText(
      body.behavioralRules,
      "Behavioral rules",
      5000
    );
  }

  if ("primarySkills" in body) {
    data.primarySkills = optionalText(
      body.primarySkills,
      "Primary skills",
      1000
    );
  }

  if ("isActive" in body) {
    data.isActive = booleanValue(body.isActive, "Active status");
  }

  if (Object.keys(data).length === 0) {
    throw new PersonaScenarioValidationError(
      "At least one persona field must be provided."
    );
  }

  return data;
}

export function validateScenarioCreate(
  body: Record<string, unknown>
): ScenarioCreateInput {
  return {
    title: requiredText(body.title, "Title", 150),
    vehicle: optionalText(body.vehicle, "Vehicle", 200),
    concern: optionalText(body.concern, "Customer concern", 1000),
    difficulty: optionalText(body.difficulty, "Difficulty", 100),
    promptNotes: optionalText(body.promptNotes, "Prompt notes", 5000),
  };
}

export function validateScenarioPatch(
  body: Record<string, unknown>
): ScenarioPatchInput {
  const data: ScenarioPatchInput = {};

  if ("title" in body) {
    data.title = requiredText(body.title, "Title", 150);
  }

  if ("vehicle" in body) {
    data.vehicle = optionalText(body.vehicle, "Vehicle", 200);
  }

  if ("concern" in body) {
    data.concern = optionalText(
      body.concern,
      "Customer concern",
      1000
    );
  }

  if ("difficulty" in body) {
    data.difficulty = optionalText(
      body.difficulty,
      "Difficulty",
      100
    );
  }

  if ("promptNotes" in body) {
    data.promptNotes = optionalText(
      body.promptNotes,
      "Prompt notes",
      5000
    );
  }

  if ("isActive" in body) {
    data.isActive = booleanValue(body.isActive, "Active status");
  }

  if (Object.keys(data).length === 0) {
    throw new PersonaScenarioValidationError(
      "At least one scenario field must be provided."
    );
  }

  return data;
}