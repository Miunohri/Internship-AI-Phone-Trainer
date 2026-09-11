export const DEFAULT_REPORT_TIME_ZONE = "America/New_York";

export type WeeklyReportPeriod = {
  start: Date;
  end: Date;
  label: string;
  timeZone: string;
};

export type WeeklyReportCriterionInput = {
  name: string;
  score: number;
  maxScore: number;
};

export type WeeklyReportSessionInput = {
  id: string;
  startedAt: Date;
  totalScore: number | null;
  maxScore: number | null;
  personaName: string;
  scenarioTitle: string;
  actionPlan: string | null;
  criteria: WeeklyReportCriterionInput[];
};

export type WeeklyReportAdvisorInput = {
  id: string;
  name: string;
  email: string;
  weeklyCallGoal: number;
  sessions: WeeklyReportSessionInput[];
};

export type WeakArea = {
  name: string;
  averagePercent: number;
  sampleSize: number;
};

export type AdvisorWeeklySummary = {
  advisorId: string;
  advisorName: string;
  advisorEmail: string;
  weeklyCallGoal: number;
  completedCalls: number;
  scoredCalls: number;
  averageScorePercent: number | null;
  goalPercent: number | null;
  weakestCriterion: WeakArea | null;
  toughestPersona: WeakArea | null;
  toughestScenario: WeakArea | null;
  latestActionPlan: string | null;
};

export type WeeklyReport = {
  period: WeeklyReportPeriod;
  advisors: AdvisorWeeklySummary[];
  team: {
    completedCalls: number;
    totalGoal: number;
    scoredCalls: number;
    averageScorePercent: number | null;
    goalPercent: number | null;
  };
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
};

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function getZonedDateTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function zonedMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string
): Date {
  const desiredUtcValue = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidateUtcValue = desiredUtcValue;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = getZonedDateTimeParts(
      new Date(candidateUtcValue),
      timeZone
    );

    const representedUtcValue = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
      represented.second
    );

    const difference = desiredUtcValue - representedUtcValue;

    if (difference === 0) {
      break;
    }

    candidateUtcValue += difference;
  }

  return new Date(candidateUtcValue);
}

function addCalendarDays(
  date: ZonedDateParts,
  numberOfDays: number
): ZonedDateParts {
  const adjusted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + numberOfDays)
  );

  return {
    year: adjusted.getUTCFullYear(),
    month: adjusted.getUTCMonth() + 1,
    day: adjusted.getUTCDate(),
  };
}

function formatCalendarDate(date: ZonedDateParts): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}

export function getPreviousCompletedWeek(
  now = new Date(),
  timeZone = DEFAULT_REPORT_TIME_ZONE
): WeeklyReportPeriod {
  const localToday = getZonedDateParts(now, timeZone);
  const localDateValue = Date.UTC(
    localToday.year,
    localToday.month - 1,
    localToday.day
  );

  const dayOfWeek = new Date(localDateValue).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const currentMonday = addCalendarDays(localToday, -daysSinceMonday);
  const previousMonday = addCalendarDays(currentMonday, -7);
  const previousSunday = addCalendarDays(currentMonday, -1);

  return {
    start: zonedMidnightToUtc(
      previousMonday.year,
      previousMonday.month,
      previousMonday.day,
      timeZone
    ),
    end: zonedMidnightToUtc(
      currentMonday.year,
      currentMonday.month,
      currentMonday.day,
      timeZone
    ),
    label: `${formatCalendarDate(previousMonday)} - ${formatCalendarDate(
      previousSunday
    )}`,
    timeZone,
  };
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length
  );
}

function calculatePercent(score: number, maxScore: number): number | null {
  if (maxScore <= 0) {
    return null;
  }

  return (score / maxScore) * 100;
}

function findWeakestArea(
  entries: Array<{
    name: string;
    percent: number;
  }>
): WeakArea | null {
  if (entries.length === 0) {
    return null;
  }

  const grouped = new Map<string, number[]>();

  for (const entry of entries) {
    const existing = grouped.get(entry.name) ?? [];
    existing.push(entry.percent);
    grouped.set(entry.name, existing);
  }

  const areas = [...grouped.entries()].map(([name, percentages]) => ({
    name,
    averagePercent: calculateAverage(percentages) ?? 0,
    sampleSize: percentages.length,
  }));

  areas.sort((first, second) => {
    if (first.averagePercent !== second.averagePercent) {
      return first.averagePercent - second.averagePercent;
    }

    if (first.sampleSize !== second.sampleSize) {
      return second.sampleSize - first.sampleSize;
    }

    return first.name.localeCompare(second.name);
  });

  return areas[0] ?? null;
}

function cleanActionPlan(actionPlan: string | null): string | null {
  if (!actionPlan) {
    return null;
  }

  const cleaned = actionPlan
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n")
    .trim();

  return cleaned || null;
}

function summarizeAdvisor(
  advisor: WeeklyReportAdvisorInput
): AdvisorWeeklySummary {
  const completedCalls = advisor.sessions.length;

  const scoredSessions = advisor.sessions.filter(
    (session) =>
      session.totalScore !== null &&
      session.maxScore !== null &&
      session.maxScore > 0
  );

  const scorePercentages = scoredSessions
    .map((session) =>
      calculatePercent(session.totalScore ?? 0, session.maxScore ?? 0)
    )
    .filter((value): value is number => value !== null);

  const criterionEntries = advisor.sessions.flatMap((session) =>
    session.criteria
      .map((criterion) => {
        const percent = calculatePercent(
          criterion.score,
          criterion.maxScore
        );

        return percent === null
          ? null
          : {
              name: criterion.name,
              percent,
            };
      })
      .filter(
        (
          value
        ): value is {
          name: string;
          percent: number;
        } => value !== null
      )
  );

  const personaEntries = scoredSessions.flatMap((session) => {
    const percent = calculatePercent(
      session.totalScore ?? 0,
      session.maxScore ?? 0
    );

    return percent === null
      ? []
      : [
          {
            name: session.personaName,
            percent,
          },
        ];
  });

  const scenarioEntries = scoredSessions.flatMap((session) => {
    const percent = calculatePercent(
      session.totalScore ?? 0,
      session.maxScore ?? 0
    );

    return percent === null
      ? []
      : [
          {
            name: session.scenarioTitle,
            percent,
          },
        ];
  });

  const latestActionPlan =
    [...advisor.sessions]
      .sort(
        (first, second) =>
          second.startedAt.getTime() - first.startedAt.getTime()
      )
      .map((session) => cleanActionPlan(session.actionPlan))
      .find((actionPlan): actionPlan is string => Boolean(actionPlan)) ?? null;

  return {
    advisorId: advisor.id,
    advisorName: advisor.name,
    advisorEmail: advisor.email,
    weeklyCallGoal: advisor.weeklyCallGoal,
    completedCalls,
    scoredCalls: scoredSessions.length,
    averageScorePercent: calculateAverage(scorePercentages),
    goalPercent:
      advisor.weeklyCallGoal > 0
        ? Math.round((completedCalls / advisor.weeklyCallGoal) * 100)
        : null,
    weakestCriterion: findWeakestArea(criterionEntries),
    toughestPersona: findWeakestArea(personaEntries),
    toughestScenario: findWeakestArea(scenarioEntries),
    latestActionPlan,
  };
}

export function buildWeeklyReport(
  period: WeeklyReportPeriod,
  advisors: WeeklyReportAdvisorInput[]
): WeeklyReport {
  const advisorSummaries = advisors
    .map(summarizeAdvisor)
    .sort((first, second) =>
      first.advisorName.localeCompare(second.advisorName)
    );

  const allScoredSessions = advisors.flatMap((advisor) =>
    advisor.sessions.filter(
      (session) =>
        session.totalScore !== null &&
        session.maxScore !== null &&
        session.maxScore > 0
    )
  );

  const teamScorePercentages = allScoredSessions
    .map((session) =>
      calculatePercent(session.totalScore ?? 0, session.maxScore ?? 0)
    )
    .filter((value): value is number => value !== null);

  const completedCalls = advisorSummaries.reduce(
    (total, advisor) => total + advisor.completedCalls,
    0
  );

  const totalGoal = advisorSummaries.reduce(
    (total, advisor) => total + advisor.weeklyCallGoal,
    0
  );

  return {
    period,
    advisors: advisorSummaries,
    team: {
      completedCalls,
      totalGoal,
      scoredCalls: allScoredSessions.length,
      averageScorePercent: calculateAverage(teamScorePercentages),
      goalPercent:
        totalGoal > 0
          ? Math.round((completedCalls / totalGoal) * 100)
          : null,
    },
  };
}

function truncate(text: string, maximumLength: number): string {
  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(0, maximumLength - 3).trimEnd()}...`;
}

function formatScore(value: number | null): string {
  return value === null ? "N/A" : `${value}%`;
}

function formatGoal(
  completedCalls: number,
  weeklyCallGoal: number
): string {
  if (weeklyCallGoal <= 0) {
    return `${completedCalls} completed; no goal assigned`;
  }

  return `${completedCalls}/${weeklyCallGoal}`;
}

function getGoalIcon(
  completedCalls: number,
  weeklyCallGoal: number
): string {
  if (weeklyCallGoal <= 0) {
    return "⚪";
  }

  return completedCalls >= weeklyCallGoal ? "✅" : "⚠️";
}

export function formatWeeklyReportForGoogleChat(
  report: WeeklyReport
): string {
  const lines: string[] = [
    "*Weekly Advisor Training Report*",
    `_${report.period.label}_`,
    "",
    "*Team Summary*",
    `• Calls completed: ${formatGoal(
      report.team.completedCalls,
      report.team.totalGoal
    )}`,
    `• Average score: ${formatScore(
      report.team.averageScorePercent
    )}`,
    `• Scored calls: ${report.team.scoredCalls}`,
  ];

  if (report.advisors.length === 0) {
    lines.push("", "No active advisors were found.");
    return lines.join("\n");
  }

  for (const advisor of report.advisors) {
    lines.push(
      "",
      `*${advisor.advisorName}*`,
      `${getGoalIcon(
        advisor.completedCalls,
        advisor.weeklyCallGoal
      )} Calls: ${formatGoal(
        advisor.completedCalls,
        advisor.weeklyCallGoal
      )} | Average: ${formatScore(advisor.averageScorePercent)}`
    );

    if (advisor.weakestCriterion) {
      lines.push(
        `• Focus area: ${advisor.weakestCriterion.name} (${advisor.weakestCriterion.averagePercent}%)`
      );
    }

    if (advisor.toughestPersona || advisor.toughestScenario) {
      const persona =
        advisor.toughestPersona?.name ?? "No scored persona";
      const scenario =
        advisor.toughestScenario?.name ?? "No scored scenario";

      lines.push(`• Toughest: ${persona} / ${scenario}`);
    }

    if (advisor.latestActionPlan) {
      const actionItems = advisor.latestActionPlan
        .split(/\n+|(?=\d+[.)]\s+)/)
        .map((item) =>
          item.replace(/^\d+[.)]\s*/, "").trim()
        )
        .filter(Boolean)
        .slice(0, 3);

      lines.push("• Corrective actions:");

      actionItems.forEach((actionItem, index) => {
        lines.push(
          `  ${index + 1}. ${truncate(actionItem, 180)}`
        );
      });
    }
  }

  return lines.join("\n");
}
