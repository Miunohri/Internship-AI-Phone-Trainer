"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

interface BrandingSettings {
  shopName: string;
  logoUrl: string;
}

const BRANDING_DEFAULTS: BrandingSettings = {
  shopName: "JB Import Auto",
  logoUrl: "/jb-logo.png",
};

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const branding = BRANDING_DEFAULTS;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  function login() {
    const callbackUrl = new URL(
      "/dashboard",
      window.location.origin
    ).toString();

    void signIn("google", { callbackUrl });
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.logoUrl}
            alt={branding.shopName}
            className="h-[72px] w-[72px] object-contain mb-4"
          />
          <h1 className="text-2xl font-bold text-[var(--jb-navy)]">
            {branding.shopName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI Phone Trainer
          </p>
        </div>

        {status === "loading" ? (
          <p className="text-sm text-slate-500">
            Loading...
          </p>
        ) : (
          <button
            type="button"
            onClick={login}
            className="w-full text-left bg-white rounded-lg shadow px-5 py-4 hover:ring-2 hover:ring-[var(--jb-blue)] transition border border-transparent"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}