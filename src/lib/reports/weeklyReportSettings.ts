import { prisma } from "@/lib/prisma";

export type WeeklyReportSettings = {
  enabled: boolean;
};

export class WeeklyReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyReportValidationError";
  }
}

export async function getWeeklyReportSettings(): Promise<WeeklyReportSettings> {
  const settings = await prisma.appBranding.findUnique({
    where: {
      id: "default",
    },
    select: {
      weeklyReportEnabled: true,
    },
  });

  return {
    enabled: settings?.weeklyReportEnabled ?? false,
  };
}

export async function updateWeeklyReportSettings(
  value: unknown
): Promise<WeeklyReportSettings> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new WeeklyReportValidationError("Weekly report settings must be an object.");
  }

  const input = value as Record<string, unknown>;

  if (typeof input.enabled !== "boolean") {
    throw new WeeklyReportValidationError("Enabled must be true or false.");
  }

  const settings = await prisma.appBranding.upsert({
    where: {
      id: "default",
    },
    create: {
      id: "default",
      weeklyReportEnabled: input.enabled,
    },
    update: {
      weeklyReportEnabled: input.enabled,
    },
    select: {
      weeklyReportEnabled: true,
    },
  });

  return {
    enabled: settings.weeklyReportEnabled,
  };
}
