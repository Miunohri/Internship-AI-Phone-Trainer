"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  ApiError,
  evaluateScorecard,
  getScorecard,
  type ScorecardResult,
} from "@/lib/api";

async function getOrEvaluateScorecard(sessionId: string) {
  try {
    return await getScorecard(sessionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return evaluateScorecard(sessionId);
    }

    throw error;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not load the call results.";
}

export default function ResultsPage() {
  const router = useRouter();
  const { status } = useSession();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [scorecard, setScorecard] = useState<ScorecardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/");
      return;
    }

    let cancelled = false;

    async function loadScorecard() {
      setLoading(true);
      setPending(false);
      setLoadError("");

      try {
        const result = await getOrEvaluateScorecard(sessionId);

        if (cancelled) return;

        setScorecard(result);
      } catch (error) {
        if (cancelled) return;

        setScorecard(null);

        if (error instanceof ApiError && error.status === 409) {
          setPending(true);
        } else {
          setLoadError(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadScorecard();

    return () => {
      cancelled = true;
    };
  }, [router, sessionId, status]);

  async function handleCheckAgain() {
    setLoading(true);
    setPending(false);
    setLoadError("");

    try {
      const result = await getOrEvaluateScorecard(sessionId);
      setScorecard(result);
    } catch (error) {
      setScorecard(null);

      if (error instanceof ApiError && error.status === 409) {
        setPending(true);
      } else {
        setLoadError(errorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--jb-charcoal)] mb-6">
          Call Results
        </h1>

        {loading && (
          <p className="text-sm text-slate-500">
            Scoring call...
          </p>
        )}

        {!loading && loadError && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-red-700 font-medium mb-2">
              Could not load call results
            </p>

            <p className="text-sm text-slate-500 mb-4">
              {loadError}
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleCheckAgain}
                className="bg-[var(--jb-navy)] hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded transition-opacity"
              >
                Try Again
              </button>

              <Link
                href="/dashboard"
                className="border border-slate-300 text-[var(--jb-charcoal)] text-sm font-medium px-4 py-2 rounded hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {!loading && pending && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-[var(--jb-charcoal)] font-medium mb-2">
              Scorecard not ready yet
            </p>

            <p className="text-sm text-slate-500 mb-4">
              The call must finish before it can be scored.
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleCheckAgain}
                className="bg-[var(--jb-navy)] hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded transition-opacity"
              >
                Check Again
              </button>

              <Link
                href="/dashboard"
                className="border border-slate-300 text-[var(--jb-charcoal)] text-sm font-medium px-4 py-2 rounded hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {!loading && scorecard && (
          <>
            <div className="bg-[var(--jb-navy)] rounded-lg shadow p-6 mb-6 text-center">
              <p className="text-xs uppercase tracking-wide text-blue-200 mb-1">
                Total Score
              </p>

              <p className="text-4xl font-bold text-white">
                {scorecard.totalScore}
                <span className="text-xl text-blue-300">
                  /{scorecard.maxScore}
                </span>
              </p>
            </div>

            {scorecard.summary && (
              <section className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="font-semibold text-[var(--jb-charcoal)] mb-2">
                  Summary
                </h2>

                <p className="text-sm text-slate-600">
                  {scorecard.summary}
                </p>
              </section>
            )}

            <section className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="font-semibold text-[var(--jb-charcoal)] mb-4">
                Scores by Criterion
              </h2>

              <div className="space-y-4">
                {(scorecard.criterionResults ?? [])
                  .slice()
                  .sort(
                    (first, second) =>
                      (first.criterionOrderSnapshot ??
                        first.criterion?.sortOrder ??
                        0) -
                      (second.criterionOrderSnapshot ??
                        second.criterion?.sortOrder ??
                        0)
                  )
                  .map((cr) => {
                    const name =
                      cr.criterionNameSnapshot ??
                      cr.criterion?.name ??
                      cr.criterionId;

                    const max =
                      cr.criterionMaxSnapshot ??
                      cr.criterion?.maxScore ??
                      5;

                    const pct = max
                      ? (cr.score / max) * 100
                      : 0;

                    return (
                      <div key={cr.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-[var(--jb-charcoal)]">
                            {name}
                          </span>

                          <span className="text-slate-500">
                            {cr.score}/{max}
                          </span>
                        </div>

                        <div className="h-2 bg-slate-200 rounded mb-2">
                          <div
                            className="h-2 bg-[var(--jb-blue)] rounded"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {cr.feedback && (
                          <p className="text-sm text-slate-600 mb-1">
                            {cr.feedback}
                          </p>
                        )}

                        {cr.evidence && (
                          <p className="text-xs text-slate-400 italic">
                            &quot;{cr.evidence}&quot;
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>

            {scorecard.actionPlan && (
              <section className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="font-semibold text-[var(--jb-charcoal)] mb-3">
                  Action Plan
                </h2>

                <p className="text-sm text-slate-600 whitespace-pre-line">
                  {scorecard.actionPlan}
                </p>
              </section>
            )}

            <div className="flex gap-3">
              <Link
                href="/train"
                className="bg-[var(--jb-navy)] hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded transition-opacity"
              >
                Train Again
              </Link>

              <Link
                href="/dashboard"
                className="border border-slate-300 text-[var(--jb-charcoal)] text-sm font-medium px-4 py-2 rounded hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
