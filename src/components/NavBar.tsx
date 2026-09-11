"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session } = useSession();
  const user = session?.user;
  const [logoUrl, setLogoUrl] = useState("/jb-logo.png");
  const [shopName, setShopName] = useState("JB Import Auto");

  useEffect(() => {
    fetch("/api/settings/branding")
      .then((r) => r.json())
      .then((data: { logoUrl?: string; shopName?: string }) => {
        if (data.logoUrl) setLogoUrl(data.logoUrl);
        if (data.shopName) setShopName(data.shopName);
      })
      .catch(() => {});
  }, []);

  function logout() {
    signOut({
      callbackUrl: new URL("/", window.location.origin).toString(),
    });
  }

  return (
    <nav className="bg-[var(--jb-navy)] text-white px-6 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={shopName}
            width={36}
            height={36}
            className="object-contain rounded"
          />
          <span className="font-bold text-white text-sm tracking-wide hidden sm:inline">
            {shopName}
          </span>
        </Link>
        <Link href="/dashboard" className="text-sm hover:text-[var(--jb-blue)] transition-colors">
          Dashboard
        </Link>
        <Link href="/train" className="text-sm hover:text-[var(--jb-blue)] transition-colors">
          Train
        </Link>
        <Link href="/history" className="text-sm hover:text-[var(--jb-blue)] transition-colors">
          History
        </Link>
        {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
          <>
            <Link
              href="/admin/results"
              className="text-sm hover:text-[var(--jb-blue)] transition-colors"
            >
              Admin Results
            </Link>

            <Link
              href="/admin/roster"
              className="text-sm hover:text-[var(--jb-blue)] transition-colors"
            >
              Roster
            </Link>            {user?.role === "ADMIN" && (

            <Link
              href="/admin/personas"
              className="text-sm hover:text-[var(--jb-blue)] transition-colors"
            >
              Personas
            </Link>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user?.role === "ADMIN" && (<Link
            href="/settings"
            className="text-blue-200 hover:text-white transition-colors"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        )}

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-200">{user.name}</span>
            <button
              onClick={logout}
              className="text-sm text-blue-300 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
