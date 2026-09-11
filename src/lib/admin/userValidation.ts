export const USER_ROLES = ["ADVISOR", "MANAGER", "ADMIN"] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];

export class UserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserValidationError";
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
    throw new UserValidationError(
      "Request body must contain valid JSON."
    );
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UserValidationError(
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
    throw new UserValidationError(
      `${fieldName} must be text.`
    );
  }

  const text = value.trim();

  if (!text) {
    throw new UserValidationError(
      `${fieldName} is required.`
    );
  }

  if (text.length > maximumLength) {
    throw new UserValidationError(
      `${fieldName} cannot exceed ${maximumLength} characters.`
    );
  }

  return text;
}

function validateEmail(value: unknown): string {
  const email = requiredText(value, "Email", 254);

  if (
    /\s/.test(email) ||
    email.split("@").length !== 2 ||
    email.startsWith("@") ||
    email.endsWith("@")
  ) {
    throw new UserValidationError(
      "Email must be a valid email address."
    );
  }

  return email.toLowerCase();
}

function validateRole(value: unknown): UserRoleValue {
  if (
    typeof value !== "string" ||
    !USER_ROLES.includes(value as UserRoleValue)
  ) {
    throw new UserValidationError(
      "Role must be ADVISOR, MANAGER, or ADMIN."
    );
  }

  return value as UserRoleValue;
}

export function validateWeeklyCallGoal(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 50
  ) {
    throw new UserValidationError(
      "weeklyCallGoal must be an integer between 0 and 50."
    );
  }

  return value;
}

export type UserCreateInput = {
  name: string;
  email: string;
  role: UserRoleValue;
  weeklyCallGoal: number;
};

export function validateUserCreate(
  body: Record<string, unknown>
): UserCreateInput {
  return {
    name: requiredText(body.name, "Name", 100),
    email: validateEmail(body.email),
    role:
      body.role === undefined
        ? "ADVISOR"
        : validateRole(body.role),
    weeklyCallGoal:
      body.weeklyCallGoal === undefined
        ? 0
        : validateWeeklyCallGoal(body.weeklyCallGoal),
  };
}

export type UserPatchInput = Partial<
  UserCreateInput & {
    isActive: boolean;
  }
>;

export function validateUserPatch(
  body: Record<string, unknown>
): UserPatchInput {
  const data: UserPatchInput = {};

  if ("name" in body) {
    data.name = requiredText(body.name, "Name", 100);
  }

  if ("email" in body) {
    data.email = validateEmail(body.email);
  }

  if ("role" in body) {
    data.role = validateRole(body.role);
  }

  if ("weeklyCallGoal" in body) {
    data.weeklyCallGoal = validateWeeklyCallGoal(
      body.weeklyCallGoal
    );
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      throw new UserValidationError(
        "isActive must be true or false."
      );
    }

    data.isActive = body.isActive;
  }

  if (Object.keys(data).length === 0) {
    throw new UserValidationError(
      "At least one user field must be provided."
    );
  }

  return data;
}
