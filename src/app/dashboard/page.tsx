"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getSessions,
  getScorecard,
  sessionDate,
  sessionTime,
  personaName,
  type Session,
  type ScorecardResult,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [details, setDetails] = useState<ScorecardResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" || !session?.user?.id) {
      router.replace("/");
      return;
    }

    const userId = session.user.id;

    async function load() {
      try {
        const sessions = await getSessions();
        const ordered = [...sessions].sort(
          (a, b) => sessionTime(a) - sessionTime(b)
        );
        const mine = ordered.filter((s) => s.userId === userId);

        setAllSessions(ordered);
        setMySessions(mine);

        const scoredMine = mine
          .filter((s) => s.scorecardResult)
          .slice(-20);

        const results = await Promise.all(
          scoredMine.map(async (s) => {
            try {
              return await getScorecard(s.id);
            } catch {
              return null;
            }
          })
        );

        setDetails(
          results.filter(
            (r): r is ScorecardResult => r !== null
          )
        );
      } catch {
        setError("Could not load sessions.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router, session?.user?.id, status]);

  const scored = mySessions.filter((s) => s.scorecardResult);
  const totalCalls = mySessions.length;
  const avgScore = scored.length
    ? scored.reduce((sum, s) => sum + percent(s.scorecardResult!), 0) / scored.length
    : 0;

  const half = Math.ceil(scored.length / 2);
  const firstHalf = scored.slice(0, half);
  const secondHalf = scored.slice(half);
  const firstAvg = firstHalf.length
    ? firstHalf.reduce((sum, s) => sum + percent(s.scorecardResult!), 0) / firstHalf.length
    : 0;
  const secondAvg = secondHalf.length
    ? secondHalf.reduce((sum, s) => sum + percent(s.scorecardResult!), 0) / secondHalf.length
    : 0;
  const trend = secondHalf.length ? secondAvg - firstAvg : 0;

  const criterionTotals: Record<string, { name: string; score: number; max: number }> = {};
  for (const result of details) {
    for (const cr of result.criterionResults ?? []) {
      const key = cr.criterionId;
      const name =
        cr.criterionNameSnapshot ??
        cr.criterion?.name ??
        key;
      const max =
        cr.criterionMaxSnapshot ??
        cr.criterion?.maxScore ??
        5;
      if (!criterionTotals[key]) criterionTotals[key] = { name, score: 0, max: 0 };
      criterionTotals[key].score += cr.score;
      criterionTotals[key].max += max;
    }
  }

  const leaderboard: Record<string, { name: string; total: number; count: number }> = {};
  for (const s of allSessions) {
    if (!s.scorecardResult) continue;
    const uid = s.userId;
    const uname = s.user?.name ?? s.user?.email ?? uid;
    if (!leaderboard[uid]) leaderboard[uid] = { name: uname, total: 0, count: 0 };
    leaderboard[uid].total += percent(s.scorecardResult);
    leaderboard[uid].count += 1;
  }
  const leaders = Object.values(leaderboard)
    .map((l) => ({ name: l.name, avg: l.total / l.count, count: l.count }))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--jb-charcoal)]">Dashboard</h1>
          <Link
            href="/train"
            className="bg-[var(--jb-navy)] hover:bg-[var(--jb-navy)] hover:opacity-90 text-white font-medium px-4 py-2 rounded transition-opacity"
          >
            Start Training Call
          </Link>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading dashboard...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard label="Training Calls Completed" value={String(totalCalls)} />
              <StatCard
                label="Average Score"
                value={scored.length ? `${avgScore.toFixed(0)}%` : "No scores yet"}
              />
              <StatCard
                label="Trend"
                value={
                  scored.length < 2
                    ? "Not enough data"
                    : trend >= 0
                    ? `Up ${trend.toFixed(0)}%`
                    : `Down ${Math.abs(trend).toFixed(0)}%`
                }
              />
            </div>

            <section className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="font-semibold text-[var(--jb-charcoal)] mb-4">Breakdown by Criterion</h2>
              {Object.keys(criterionTotals).length === 0 && (
                <p className="text-sm text-slate-500">
                  No scored calls yet. Complete a training call to see your breakdown.
                </p>
              )}
              <div className="space-y-3">
                {Object.entries(criterionTotals).map(([key, c]) => {
                  const pct = c.max ? (c.score / c.max) * 100 : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--jb-charcoal)]">{c.name}</span>
                        <span className="text-slate-500">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded">
                        <div className="h-2 bg-[var(--jb-blue)] rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[var(--jb-charcoal)]">Leaderboard</h2>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLeaderboard}
                    onChange={(e) => setShowLeaderboard(e.target.checked)}
                    className="accent-[var(--jb-navy)]"
                  />
                  Show leaderboard
                </label>
              </div>
              {showLeaderboard ? (
                leaders.length ? (
                  <ol className="space-y-2">
                    {leaders.map((l, i) => (
                      <li key={l.name} className="flex justify-between text-sm">
                        <span className="text-[var(--jb-charcoal)]">
                          {i + 1}. {l.name}
                        </span>
                        <span className="text-slate-500">
                          {l.avg.toFixed(0)}% avg over {l.count} calls
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-slate-500">No scored calls yet across the team.</p>
                )
              ) : (
                <p className="text-sm text-slate-400">Leaderboard is hidden.</p>
              )}
            </section>

            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-[var(--jb-charcoal)] mb-4">Recent Calls</h2>
              {mySessions.length === 0 && (
                <p className="text-sm text-slate-500">No training calls yet.</p>
              )}
              <ul className="divide-y divide-slate-100">
                {[...mySessions].reverse().slice(0, 10).map((s) => (
                  <li key={s.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--jb-charcoal)]">{personaName(s)}</p>
                      <p className="text-xs text-slate-400">{sessionDate(s)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {s.scorecardResult ? (
                        <span className="text-sm font-semibold text-[var(--jb-charcoal)]">
                          {s.scorecardResult.totalScore}/{s.scorecardResult.maxScore}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not scored</span>
                      )}
                      <Link
                        href={`/results/${s.id}`}
                        className="text-sm text-[var(--jb-navy)] hover:underline font-medium"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function percent(result: { totalScore: number; maxScore: number }): number {
  if (!result.maxScore) return 0;
  return (result.totalScore / result.maxScore) * 100;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 border-t-4 border-[var(--jb-navy)]">
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-[var(--jb-charcoal)]">{value}</p>
    </div>
  );
}
