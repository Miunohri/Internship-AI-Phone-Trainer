"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import WeeklyReportSettings from "@/components/WeeklyReportSettings";
import ScorecardSettings from "@/components/ScorecardSettings";

interface BrandingSettings {
  shopName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const DEFAULTS: BrandingSettings = {
  shopName: "JB Import Auto",
  logoUrl: "/jb-logo.png",
  primaryColor: "#002f6b",
  secondaryColor: "#5c7bb1",
  accentColor: "#3b3a39",
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: authSession, status } = useSession();
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
  if (status === "loading") {
    return;
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return;
  }

  if (authSession?.user?.role !== "ADMIN") {
    router.replace("/auth/forbidden");
    return;
  }

    fetch("/api/settings/branding")
      .then((r) => r.json())
      .then((data: BrandingSettings) => setBranding({ ...DEFAULTS, ...data }))
      .catch(() => setError("Could not load branding settings."))
      .finally(() => setLoading(false));
  }, [authSession?.user?.role, router, status]);

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (!res.ok) throw new Error("Save failed");

      // Apply new CSS variables immediately so the current page reflects the change
      document.documentElement.style.setProperty("--jb-navy", branding.primaryColor);
      document.documentElement.style.setProperty("--jb-blue", branding.secondaryColor);
      document.documentElement.style.setProperty("--jb-charcoal", branding.accentColor);

      setSuccess(
        "Branding saved. Other pages will pick up the new colors and name on their next load."
      );
    } catch {
      setError("Could not save branding settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <main className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-[var(--jb-charcoal)]">Settings</h1>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading...</p>}

        {!loading && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-[var(--jb-charcoal)] mb-1">Branding</h2>
            <p className="text-sm text-slate-500 mb-6">
              Update the shop name, logo, and color scheme. These changes are applied
              across the entire app.
            </p>

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

            <div className="space-y-6">
              {/* Shop Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Shop Name
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Shown on the sign-in screen and throughout the app header.
                </p>
                <input
                  type="text"
                  value={branding.shopName}
                  onChange={(e) => setBranding({ ...branding, shopName: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Your Dealership Name"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Logo URL
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Paste a URL to your logo image, or use a path like{" "}
                  <span className="font-mono">/my-logo.png</span> if the file is in the{" "}
                  <span className="font-mono">public/</span> folder.
                </p>
                <input
                  type="text"
                  value={branding.logoUrl}
                  onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="https://example.com/logo.png"
                />
                {branding.logoUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logoUrl}
                      alt="Logo preview"
                      className="h-12 w-12 object-contain rounded border border-slate-200 bg-slate-50 p-1"
                    />
                    <span className="text-xs text-slate-400">Preview</span>
                  </div>
                )}
              </div>

              <ColorField
                label="Primary Color"
                description="Navigation bar, primary buttons, and key accents."
                value={branding.primaryColor}
                onChange={(v) => setBranding({ ...branding, primaryColor: v })}
              />

              <ColorField
                label="Secondary Color"
                description="Hover states, progress bars, and secondary highlights."
                value={branding.secondaryColor}
                onChange={(v) => setBranding({ ...branding, secondaryColor: v })}
              />

              <ColorField
                label="Accent Color"
                description="Primary text and headings throughout the app."
                value={branding.accentColor}
                onChange={(v) => setBranding({ ...branding, accentColor: v })}
              />
            </div>

            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="bg-[var(--jb-navy)] hover:opacity-90 disabled:opacity-60 text-white font-semibold px-6 py-2 rounded text-sm transition-opacity"
              >
                {saving ? "Saving..." : "Save Branding"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBranding(DEFAULTS);
                  setSuccess("");
                  setError("");
                }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          </section>
        )}
        {!loading && <WeeklyReportSettings />}
        {!loading && <ScorecardSettings />}
      </main>
    </div>
  );
}

function ColorField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </label>
      <p className="text-xs text-slate-400 mb-2">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 rounded border border-slate-300 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
          placeholder="#000000"
        />
        <span
          className="h-8 w-8 rounded border border-slate-200 flex-shrink-0"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  );
}
