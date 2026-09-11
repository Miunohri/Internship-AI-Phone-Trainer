import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { readBranding } from "@/lib/branding";
import AuthSessionProvider from "@/components/AuthSessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JB Import Auto Ã¢â‚¬â€œ AI Phone Trainer",
  description: "AI-powered phone training for JB Import Auto service advisors",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await readBranding();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `:root{--jb-navy:${branding.primaryColor};--jb-blue:${branding.secondaryColor};--jb-charcoal:${branding.accentColor};}`,
        }} />
      </head>
      <body className="min-h-full flex flex-col"><AuthSessionProvider>{children}</AuthSessionProvider></body>
    </html>
  );
}
