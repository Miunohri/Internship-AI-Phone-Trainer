"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getSessions, sessionDate, sessionTime, personaName, type Session } from "@/lib/api";

export default function HistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
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

    getSessions()
      .then((all) => {
        const mine = all
          .filter((s) => s.userId === userId)
          .sort((a, b) => sessionTime(b) - sessionTime(a));

        setSessions(mine);
      })
      .catch(() => setError("Could not load session history."))
      .finally(() => setLoading(false));
  }, [router, session?.user?.id, status]);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Call History</h1>

        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && sessions.length === 0 && !error && (
          <p className="text-sm text-slate-500">No training calls yet.</p>
        )}

        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="bg-white rounded-lg shadow px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{personaName(s)}</p>
                <p className="text-xs text-slate-400">{sessionDate(s)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.status}</p>
              </div>
              <div className="flex items-center gap-4">
                {s.scorecardResult ? (
                  <span className="text-sm font-semibold text-slate-700">
                    {s.scorecardResult.totalScore}/{s.scorecardResult.maxScore}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not scored</span>
                )}
                <Link
                  href={`/results/${s.id}`}
                  className="text-sm text-amber-600 hover:underline"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
