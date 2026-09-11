"use client";

import { useEffect, useState } from "react";

type WeeklyReportSettings = {
  enabled: boolean;
};

export default function WeeklyReportSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/settings/weekly-report", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load weekly report settings.");
        }

        return (await response.json()) as WeeklyReportSettings;
      })
      .then((settings) => setEnabled(settings.enabled))
      .catch(() => setError("Could not load weekly report settings."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/settings/weekly-report", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not save weekly report settings.");
      }

      const settings = (await response.json()) as WeeklyReportSettings;
      setEnabled(settings.enabled);
      setSuccess(
        settings.enabled
          ? "Automatic weekly reports are enabled."
          : "Automatic weekly reports are disabled."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save weekly report settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-lg shadow p-6 mt-6">
      <h2 className="font-semibold text-[var(--jb-charcoal)] mb-1">
        Weekly Reports
      </h2>

      <p className="text-sm text-slate-500 mb-6">
        Control whether the prior week&apos;s advisor-performance report is
        automatically sent to Google Chat each Monday at 9:00 a.m. Eastern.
      </p>

      {loading && (
        <p className="text-sm text-slate-500">
          Loading weekly report settings...
        </p>
      )}

      {!loading && (
        <>
          {error && (
            <p className="bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg px-4 py-3 mb-5">
              {error}
            </p>
          )}

          {success && (
            <p className="bg-green-50 border border-green-200 text-sm text-green-700 rounded-lg px-4 py-3 mb-5">
              {success}
            </p>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
                setSuccess("");
              }}
              className="mt-1 h-4 w-4"
            />

            <span>
              <span className="block text-sm font-semibold text-slate-700">
                Send weekly Google Chat report
              </span>

              <span className="block text-xs text-slate-500 mt-1">
                Leave this disabled until the app is ready to begin automatic
                reporting.
              </span>
            </span>
          </label>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-[var(--jb-navy)] hover:opacity-90 disabled:opacity-60 text-white font-semibold px-6 py-2 rounded text-sm transition-opacity"
            >
              {saving ? "Saving..." : "Save Report Settings"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
