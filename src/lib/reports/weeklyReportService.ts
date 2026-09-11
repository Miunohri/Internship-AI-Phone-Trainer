import { prisma } from "@/lib/prisma";
import {
  buildWeeklyReport,
  getPreviousCompletedWeek,
  type WeeklyReport,
  type WeeklyReportAdvisorInput,
} from "./weeklyReport";

export async function generatePreviousWeekReport(
  now = new Date()
): Promise<WeeklyReport> {
  const period = getPreviousCompletedWeek(now);

  const advisors = await prisma.user.findMany({
    where: {
      role: "ADVISOR",
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    include: {
      trainingSessions: {
        where: {
          status: "COMPLETED",
          startedAt: {
            gte: period.start,
            lt: period.end,
          },
        },
        orderBy: {
          startedAt: "desc",
        },
        include: {
          persona: {
            select: {
              name: true,
            },
          },
          scenario: {
            select: {
              title: true,
            },
          },
          scorecardResult: {
            select: {
              totalScore: true,
              maxScore: true,
              actionPlan: true,
              criterionResults: {
                select: {
                  score: true,
                  criterionNameSnapshot: true,
                  criterionMaxSnapshot: true,
                  criterionOrderSnapshot: true,
                  criterion: {
                    select: {
                      name: true,
                      maxScore: true,
                      sortOrder: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const reportAdvisors: WeeklyReportAdvisorInput[] = advisors.map(
    (advisor) => ({
      id: advisor.id,
      name: advisor.name,
      email: advisor.email,
      weeklyCallGoal: advisor.weeklyCallGoal,
      sessions: advisor.trainingSessions.map((session) => ({
        id: session.id,
        startedAt: session.startedAt,
        totalScore: session.scorecardResult?.totalScore ?? null,
        maxScore: session.scorecardResult?.maxScore ?? null,
        personaName: session.persona.name,
        scenarioTitle: session.scenario.title,
        actionPlan: session.scorecardResult?.actionPlan ?? null,
        criteria:
          session.scorecardResult?.criterionResults
            .slice()
            .sort(
              (first, second) =>
                (first.criterionOrderSnapshot ??
                  first.criterion.sortOrder) -
                (second.criterionOrderSnapshot ??
                  second.criterion.sortOrder)
            )
            .map((result) => ({
              name:
                result.criterionNameSnapshot ??
                result.criterion.name,
              score: result.score,
              maxScore:
                result.criterionMaxSnapshot ??
                result.criterion.maxScore,
            })) ?? [],
      })),
    })
  );

  return buildWeeklyReport(period, reportAdvisors);
}
