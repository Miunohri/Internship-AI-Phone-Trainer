"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getAdminAdvisorResults,
  personaName,
  sessionDate,
  sessionTime,
  type Session,
  type User,
} from "@/lib/api";

function formatPercent(value: number | null) {
  if (value === null) return "N/A";
  return `${value}%`;
}

function preview(text?: string | null, fallback = "No action plan yet") {
  if (!text) return fallback;
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function scorePercent(session: Session) {
  const result = session.scorecardResult;

  if (!result || result.maxScore === 0) {
    return null;
  }

  return Math.round((result.totalScore / result.maxScore) * 100);
}

type WeakCategoryDraft = {
  name: string;
  scoreTotal: number;
  count: number;
};

type SituationDraft = {
  key: string;
  persona: string;
  scenario: string;
  vehicle: string;
  calls: number;
  scoredCalls: number;
  scorePercentTotal: number;
  recentActionPlans: string[];
  weakCategories: Map<string, WeakCategoryDraft>;
};

export default function AdminAdvisorResultsPage() {
  const router = useRouter();
  const { data: authSession, status } = useSession();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [advisor, setAdvisor] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/");
      return;
    }

    const role = authSession?.user?.role;

    if (role !== "MANAGER" && role !== "ADMIN") {
      router.replace("/auth/forbidden");
      return;
    }

    getAdminAdvisorResults(userId)
      .then((data) => {
        setAdvisor(data.advisor);
        setSessions([...data.sessions].sort((a, b) => sessionTime(b) - sessionTime(a)));
      })
      .catch(() => setError("Could not load advisor results."))
      .finally(() => setLoading(false));
  }, [authSession?.user?.role, router, status, userId]);

  const stats = useMemo(() => {
    const completed = sessions.filter((session) => session.status === "COMPLETED");
    const scored = sessions.filter((session) => session.scorecardResult);

    const averagePercent =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, session) => {
              const result = session.scorecardResult;
              if (!result || result.maxScore === 0) return sum;
              return sum + (result.totalScore / result.maxScore) * 100;
            }, 0) / scored.length
          )
        : null;

    return {
      total: sessions.length,
      completed: completed.length,
      scored: scored.length,
      averagePercent,
    };
  }, [sessions]);

  const criterionSummaries = useMemo(() => {
    const byCriterion = new Map<
      string,
      {
        criterionId: string;
        name: string;
        scoredCount: number;
        scorePercentTotal: number;
        latestFeedback: string;
      }
    >();

    

    for (const session of sessions) {
      for (const criterionResult of session.scorecardResult?.criterionResults ?? []) {
        const maxScore = criterionResult.criterionMaxSnapshot ?? criterionResult.criterion?.maxScore ?? 5;
        const existing = byCriterion.get(criterionResult.criterionId);

        const current = existing ?? {
          criterionId: criterionResult.criterionId,
          name: criterionResult.criterionNameSnapshot ?? criterionResult.criterion?.name ?? criterionResult.criterionId,
          scoredCount: 0,
          scorePercentTotal: 0,
          latestFeedback: "",
        };

        current.scoredCount += 1;

        if (maxScore > 0) {
          current.scorePercentTotal += (criterionResult.score / maxScore) * 100;
        }

        if (!current.latestFeedback && criterionResult.feedback) {
          current.latestFeedback = criterionResult.feedback;
        }

        byCriterion.set(criterionResult.criterionId, current);
      }
    }

    return [...byCriterion.values()]
      .map((criterion) => ({
        ...criterion,
        averagePercent:
          criterion.scoredCount > 0
            ? Math.round(criterion.scorePercentTotal / criterion.scoredCount)
            : null,
      }))
      .sort((a, b) => {
        const aScore = a.averagePercent ?? 999;
        const bScore = b.averagePercent ?? 999;
        return aScore - bScore;
      });
  }, [sessions]);

  const situationSummaries = useMemo(() => {
    const bySituation = new Map<string, SituationDraft>();

    for (const session of sessions) {
      const key = `${session.personaId}:${session.scenarioId}`;

      const current =
        bySituation.get(key) ??
        {
          key,
          persona: personaName(session),
          scenario: session.scenario?.title ?? "Scenario",
          vehicle: session.scenario?.vehicle ?? "",
          calls: 0,
          scoredCalls: 0,
          scorePercentTotal: 0,
          recentActionPlans: [],
          weakCategories: new Map<string, WeakCategoryDraft>(),
        };

      current.calls += 1;

      const percent = scorePercent(session);
      if (percent !== null) {
        current.scoredCalls += 1;
        current.scorePercentTotal += percent;
      }

      const actionPlan = session.scorecardResult?.actionPlan;
      if (actionPlan && current.recentActionPlans.length < 2) {
        current.recentActionPlans.push(actionPlan);
      }

      for (const criterionResult of session.scorecardResult?.criterionResults ?? []) {
        const maxScore = criterionResult.criterionMaxSnapshot ?? criterionResult.criterion?.maxScore ?? 5;

        if (maxScore <= 0) continue;

        const existingCategory = current.weakCategories.get(
          criterionResult.criterionId
        );

        const category =
          existingCategory ??
          {
            name: criterionResult.criterionNameSnapshot ?? criterionResult.criterion?.name ?? criterionResult.criterionId,
            scoreTotal: 0,
            count: 0,
          };

        category.scoreTotal += (criterionResult.score / maxScore) * 100;
        category.count += 1;

        current.weakCategories.set(criterionResult.criterionId, category);
      }

      bySituation.set(key, current);
    }

    return [...bySituation.values()]
      .map((situation) => ({
        key: situation.key,
        persona: situation.persona,
        scenario: situation.scenario,
        vehicle: situation.vehicle,
        calls: situation.calls,
        scoredCalls: situation.scoredCalls,
        averagePercent:
          situation.scoredCalls > 0
            ? Math.round(situation.scorePercentTotal / situation.scoredCalls)
            : null,
        weakCategories: [...situation.weakCategories.values()]
          .map((category) => ({
            name: category.name,
            averagePercent:
              category.count > 0
                ? Math.round(category.scoreTotal / category.count)
                : null,
          }))
          .sort((a, b) => {
            const aScore = a.averagePercent ?? 999;
            const bScore = b.averagePercent ?? 999;
            return aScore - bScore;
          })
          .slice(0, 2),
        recentActionPlans: situation.recentActionPlans,
      }))
      .sort((a, b) => {
        const aScore = a.averagePercent ?? 999;
        const bScore = b.averagePercent ?? 999;
        return aScore - bScore;
      });
  }, [sessions]);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <Link
            href="/admin/results"
            className="text-sm font-medium text-[var(--jb-navy)] hover:underline"
          >
            Ã¢â€ Â Back to Admin Results
          </Link>

          <p className="text-xs uppercase tracking-wide text-slate-400 mt-4 mb-1">
            Advisor Results
          </p>

          <h1 className="text-2xl font-bold text-[var(--jb-charcoal)]">
            {advisor?.name ?? "Advisor"}
          </h1>

          {advisor?.email && (
            <p className="text-sm text-slate-500 mt-1">{advisor.email}</p>
          )}
        </div>

        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <>
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              {[
                { label: "Sessions", value: stats.total },
                { label: "Completed", value: stats.completed },
                { label: "Scored", value: stats.scored },
                { label: "Average Score", value: formatPercent(stats.averagePercent) },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-lg shadow p-5 border-t-4 border-[var(--jb-navy)]">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-[var(--jb-charcoal)]">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Criterion trends */}
            <section className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-[var(--jb-charcoal)]">Scorecard Category Trends</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Lowest average categories appear first so managers can quickly
                  see where the advisor may need coaching.
                </p>
              </div>

              {criterionSummaries.length === 0 ? (
                <p className="text-sm text-slate-500 px-5 py-4">
                  No scorecard category data yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Category", "Avg. Score", "Scored Calls", "Recent Feedback"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {criterionSummaries.map((criterion) => (
                        <tr key={criterion.criterionId} className="hover:bg-slate-50">
                          <td className="px-4 py-4 text-sm font-medium text-[var(--jb-charcoal)]">
                            {criterion.name}
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-[var(--jb-charcoal)]">
                            {formatPercent(criterion.averagePercent)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {criterion.scoredCount}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600 max-w-lg">
                            {criterion.latestFeedback || "No feedback yet"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Persona / situation performance */}
            <section className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-[var(--jb-charcoal)]">
                  Persona / Situation Performance
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Lowest-performing customer types and scenarios appear first so
                  managers can quickly identify where the advisor may need coaching.
                </p>
              </div>

              {situationSummaries.length === 0 ? (
                <p className="text-sm text-slate-500 px-5 py-4">
                  No persona or situation data yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Persona / Situation",
                          "Calls",
                          "Avg. Score",
                          "Weakest Categories",
                          "Recent Corrective Actions",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {situationSummaries.map((situation) => (
                        <tr key={situation.key} className="hover:bg-slate-50">
                          <td className="px-4 py-4 align-top">
                            <p className="text-sm font-medium text-[var(--jb-charcoal)]">
                              {situation.persona}
                            </p>
                            <p className="text-sm text-slate-600">
                              {situation.scenario}
                            </p>
                            {situation.vehicle && (
                              <p className="text-xs text-slate-400">
                                {situation.vehicle}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-slate-700">
                            {situation.calls}
                          </td>

                          <td className="px-4 py-4 align-top text-sm font-semibold text-[var(--jb-charcoal)]">
                            {formatPercent(situation.averagePercent)}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-slate-600">
                            {situation.weakCategories.length === 0 ? (
                              "N/A"
                            ) : (
                              <div className="space-y-1">
                                {situation.weakCategories.map((category) => (
                                  <p key={category.name}>
                                    {category.name}:{" "}
                                    {formatPercent(category.averagePercent)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-slate-600 max-w-md">
                            {situation.recentActionPlans.length === 0 ? (
                              "No action plans yet"
                            ) : (
                              <div className="space-y-3">
                                {situation.recentActionPlans.map(
                                  (actionPlan, index) => (
                                    <p key={`${situation.key}-action-${index}`}>
                                      {preview(actionPlan)}
                                    </p>
                                  )
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Individual sessions */}
            <section className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-[var(--jb-charcoal)]">Individual Sessions</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Training sessions and scorecards for this advisor.
                </p>
              </div>

              {sessions.length === 0 ? (
                <p className="text-sm text-slate-500 px-5 py-4">
                  No training sessions for this advisor yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Date", "Persona", "Scenario", "Score", "Action Plan", "Action"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.map((session) => (
                        <tr key={session.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4 align-top text-sm text-slate-500">
                            {sessionDate(session)}
                          </td>
                          <td className="px-4 py-4 align-top text-sm text-slate-700">
                            {personaName(session)}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <p className="text-sm text-slate-700">{session.scenario?.title ?? "Scenario"}</p>
                            {session.scenario?.vehicle && (
                              <p className="text-xs text-slate-400">{session.scenario.vehicle}</p>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top text-sm font-semibold text-[var(--jb-charcoal)]">
                            {session.scorecardResult
                              ? `${session.scorecardResult.totalScore}/${session.scorecardResult.maxScore}`
                              : "Not scored"}
                          </td>
                          <td className="px-4 py-4 align-top text-sm text-slate-600 max-w-md">
                            {preview(session.scorecardResult?.actionPlan)}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <Link
                              href={`/results/${session.id}`}
                              className="text-sm font-medium text-[var(--jb-navy)] hover:underline"
                            >
                              View Results
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="text-xs text-slate-400 mt-4">
            Note: this advisor drilldown is a foundation view. Assigned weekly
            calls and auth/role restrictions will be handled in later work.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
