"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getAdminResults,
  getUsers,
  personaName,
  sessionDate,
  sessionTime,
  updateWeeklyCallGoal,
  type Session,
  type User,
} from "@/lib/api";

type TimeFilter = "ALL" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "YTD";

const timeFilters: { label: string; value: TimeFilter }[] = [
  { label: "All Time", value: "ALL" },
  { label: "Yesterday", value: "YESTERDAY" },
  { label: "Last 7 Days", value: "LAST_7_DAYS" },
  { label: "Last 30 Days", value: "LAST_30_DAYS" },
  { label: "Year to Date", value: "YTD" },
];

function preview(text?: string | null, fallback = "No summary yet") {
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfCurrentWeek() {
  const today = startOfDay(new Date());
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  return today;
}

function matchesTimeFilter(session: Session, filter: TimeFilter) {
  if (filter === "ALL") return true;

  const startedAt = new Date(session.startedAt);
  const now = new Date();
  const today = startOfDay(now);

  if (filter === "YESTERDAY") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return startedAt >= yesterday && startedAt < today;
  }

  if (filter === "LAST_7_DAYS") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return startedAt >= sevenDaysAgo;
  }

  if (filter === "LAST_30_DAYS") {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return startedAt >= thirtyDaysAgo;
  }

  if (filter === "YTD") {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return startedAt >= startOfYear;
  }

  return true;
}

function formatScorePercent(value: number | null) {
  if (value === null) return "N/A";
  return `${value}%`;
}

function formatGoalProgress(completed: number, goal: number) {
  if (goal <= 0) return `${completed} completed`;
  return `${completed}/${goal}`;
}

export default function AdminResultsPage() {
  const router = useRouter();
  const { data: authSession, status } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<TimeFilter>("ALL");
  const [savingGoalFor, setSavingGoalFor] = useState<string | null>(null);
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
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

    Promise.all([getAdminResults(), getUsers()])
      .then(([sessionData, userData]) => {
        const sorted = [...sessionData].sort((a, b) => sessionTime(b) - sessionTime(a));
        setSessions(sorted);
        setUsers(userData);
      })
      .catch(() => setError("Could not load admin results."))
      .finally(() => setLoading(false));
  }, [authSession?.user?.role, router, status]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => matchesTimeFilter(session, selectedFilter));
  }, [sessions, selectedFilter]);

  const weeklyCompletedByAdvisor = useMemo(() => {
    const weekStart = startOfCurrentWeek();
    const completedByAdvisor = new Map<string, number>();

    for (const session of sessions) {
      const startedAt = new Date(session.startedAt);

      if (session.status !== "COMPLETED" || startedAt < weekStart) {
        continue;
      }

      const advisorId = session.user?.id ?? session.userId;
      completedByAdvisor.set(advisorId, (completedByAdvisor.get(advisorId) ?? 0) + 1);
    }

    return completedByAdvisor;
  }, [sessions]);

  const stats = useMemo(() => {
    const completed = filteredSessions.filter(
      (session) => session.status === "COMPLETED"
    );

    const scored = filteredSessions.filter((session) => session.scorecardResult);

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
      total: filteredSessions.length,
      completed: completed.length,
      scored: scored.length,
      averagePercent,
    };
  }, [filteredSessions]);

  const advisorSummaries = useMemo(() => {
    const byAdvisor = new Map<
      string,
      {
        advisorId: string;
        advisorName: string;
        advisorEmail?: string;
        weeklyCallGoal: number;
        currentWeekCompletedCalls: number;
        completedCalls: number;
        scoredCalls: number;
        scorePercentTotal: number;
        lastSessionTime: number;
        lastSessionLabel: string;
      }
    >();

    for (const user of users.filter((user) => user.role === "ADVISOR")) {
      byAdvisor.set(user.id, {
        advisorId: user.id,
        advisorName: user.name,
        advisorEmail: user.email,
        weeklyCallGoal: user.weeklyCallGoal ?? 0,
        currentWeekCompletedCalls: weeklyCompletedByAdvisor.get(user.id) ?? 0,
        completedCalls: 0,
        scoredCalls: 0,
        scorePercentTotal: 0,
        lastSessionTime: 0,
        lastSessionLabel: "",
      });
    }

    for (const session of filteredSessions) {
      const advisorId = session.user?.id ?? session.userId;
      const existing = byAdvisor.get(advisorId);

      const current = existing ?? {
        advisorId,
        advisorName: session.user?.name ?? "Unknown Advisor",
        advisorEmail: session.user?.email,
        weeklyCallGoal: session.user?.weeklyCallGoal ?? 0,
        currentWeekCompletedCalls: weeklyCompletedByAdvisor.get(advisorId) ?? 0,
        completedCalls: 0,
        scoredCalls: 0,
        scorePercentTotal: 0,
        lastSessionTime: 0,
        lastSessionLabel: "",
      };

      if (session.status === "COMPLETED") {
        current.completedCalls += 1;
      }

      if (session.scorecardResult && session.scorecardResult.maxScore > 0) {
        current.scoredCalls += 1;
        current.scorePercentTotal +=
          (session.scorecardResult.totalScore / session.scorecardResult.maxScore) *
          100;
      }

      const currentSessionTime = sessionTime(session);
      if (currentSessionTime > current.lastSessionTime) {
        current.lastSessionTime = currentSessionTime;
        current.lastSessionLabel = sessionDate(session);
      }

      byAdvisor.set(advisorId, current);
    }

    return [...byAdvisor.values()]
      .map((advisor) => ({
        ...advisor,
        averagePercent:
          advisor.scoredCalls > 0
            ? Math.round(advisor.scorePercentTotal / advisor.scoredCalls)
            : null,
        weeklyRemaining: Math.max(
          advisor.weeklyCallGoal - advisor.currentWeekCompletedCalls,
          0
        ),
      }))
      .sort((a, b) => {
        if (b.lastSessionTime !== a.lastSessionTime) {
          return b.lastSessionTime - a.lastSessionTime;
        }

        return a.advisorName.localeCompare(b.advisorName);
      });
  }, [filteredSessions, users, weeklyCompletedByAdvisor]);

  function updateGoalDraft(userId: string, value: string) {
    setGoalDrafts((current) => ({
      ...current,
      [userId]: value,
    }));
  }

  async function saveWeeklyGoal(userId: string, value: string) {
    const parsedGoal = Number(value);
    const normalizedGoal = Number.isFinite(parsedGoal)
      ? Math.min(50, Math.max(0, Math.round(parsedGoal)))
      : 0;

    try {
      setSavingGoalFor(userId);

      const updatedUser = await updateWeeklyCallGoal(
        userId,
        normalizedGoal
      );

      setUsers((currentUsers) => {
        const userExists = currentUsers.some(
          (user) => user.id === updatedUser.id
        );

        if (!userExists) {
          return [...currentUsers, updatedUser];
        }

        return currentUsers.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        );
      });

      setGoalDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    } catch {
      setError("Could not update weekly call goal.");
    } finally {
      setSavingGoalFor(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-[var(--jb-charcoal)]">Training Results</h1>
          <p className="text-sm text-slate-500 mt-2">
            Manager view for reviewing advisor training sessions, scorecards, and
            action-plan feedback.
          </p>
        </div>

        {/* Time filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <p className="text-sm font-semibold text-[var(--jb-charcoal)] mb-3">Time Segment</p>
          <div className="flex flex-wrap gap-2">
            {timeFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSelectedFilter(filter.value)}
                className={
                  selectedFilter === filter.value
                    ? "rounded-full bg-[var(--jb-navy)] px-4 py-2 text-sm font-medium text-white"
                    : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[
            { label: "Sessions", value: stats.total },
            { label: "Completed", value: stats.completed },
            { label: "Scored", value: stats.scored },
            { label: "Group Average", value: formatScorePercent(stats.averagePercent) },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow p-5 border-t-4 border-[var(--jb-navy)]">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-[var(--jb-charcoal)]">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Advisor summary table */}
        <section className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-[var(--jb-charcoal)]">Advisor Summary</h2>
            <p className="text-sm text-slate-500 mt-1">
              Advisor performance and weekly call assignments. Weekly progress always
              reflects the current week, regardless of the selected time segment.
            </p>
          </div>

          {loading && <p className="text-sm text-slate-500 px-5 py-4">Loading...</p>}
          {error && <p className="text-sm text-red-600 px-5 py-4">{error}</p>}

          {!loading && advisorSummaries.length === 0 && !error && (
            <p className="text-sm text-slate-500 px-5 py-4">
              No advisors available yet.
            </p>
          )}

          {!loading && advisorSummaries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Advisor",
                      "Weekly Goal",
                      "This Week",
                      "Remaining",
                      "Completed Calls",
                      "Scored Calls",
                      "Average Score",
                      "Last Session",
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
                  {advisorSummaries.map((advisor) => (
                    <tr key={advisor.advisorId} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/advisors/${advisor.advisorId}`}
                          className="text-sm font-medium text-[var(--jb-navy)] hover:underline"
                        >
                          {advisor.advisorName}
                        </Link>
                        <p className="text-xs text-slate-400">{advisor.advisorEmail}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={
                              goalDrafts[advisor.advisorId] ??
                              String(advisor.weeklyCallGoal)
                            }
                            onChange={(event) =>
                              updateGoalDraft(
                                advisor.advisorId,
                                event.target.value
                              )
                            }
                            onBlur={(event) =>
                              void saveWeeklyGoal(
                                advisor.advisorId,
                                event.target.value
                              )
                            }
                            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                            aria-label={`Weekly call goal for ${advisor.advisorName}`}
                          />
                          {savingGoalFor === advisor.advisorId && (
                            <span className="text-xs text-slate-400">Saving...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatGoalProgress(
                          advisor.currentWeekCompletedCalls,
                          advisor.weeklyCallGoal
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-[var(--jb-charcoal)]">
                        {advisor.weeklyCallGoal > 0 ? advisor.weeklyRemaining : "N/A"}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {advisor.completedCalls}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {advisor.scoredCalls}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-[var(--jb-charcoal)]">
                        {formatScorePercent(advisor.averagePercent)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {advisor.lastSessionLabel || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!loading && filteredSessions.length === 0 && !error && (
          <p className="text-sm text-slate-500">No training sessions yet.</p>
        )}

        {/* Session results table */}
        {!loading && filteredSessions.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-[var(--jb-charcoal)]">Session Results</h2>
              <p className="text-sm text-slate-500 mt-1">
                Individual training sessions for the selected time segment.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {["Advisor", "Persona", "Scenario", "Date", "Status", "Score", "Summary", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm font-medium text-[var(--jb-charcoal)]">
                          {session.user?.name ?? "Unknown Advisor"}
                        </p>
                        <p className="text-xs text-slate-400">{session.user?.email}</p>
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
                      <td className="px-4 py-4 align-top text-sm text-slate-500">
                        {sessionDate(session)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-semibold text-[var(--jb-charcoal)]">
                        {session.scorecardResult
                          ? `${session.scorecardResult.totalScore}/${session.scorecardResult.maxScore}`
                          : "Not scored"}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-600 max-w-xs">
                        {preview(session.scorecardResult?.summary)}
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
          </div>
        )}

        <p className="text-xs text-slate-400 mt-4">
          Note: this is an admin/reporting foundation view. Authentication, role
          restrictions, roster management, and report automation will be handled
          in later work.
        </p>
      </main>
    </div>
  );
}
