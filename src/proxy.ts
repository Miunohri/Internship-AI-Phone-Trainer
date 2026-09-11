import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const managerPages = [
  "/admin/results",
  "/admin/advisors",
  "/admin/roster",
];

const adminPages = [
  "/admin/personas",
  "/settings",
];

function startsWithAny(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname === "/auth/forbidden" ||
    pathname === "/api/cron/weekly-report"
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      new URL(
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
        request.url
      ).toString()
    );

    return NextResponse.redirect(loginUrl);
  }

  if (startsWithAny(pathname, managerPages)) {
    if (token.role !== "MANAGER" && token.role !== "ADMIN") {
      return NextResponse.redirect(
        new URL("/auth/forbidden", request.url)
      );
    }

    return NextResponse.next();
  }

  if (
    startsWithAny(pathname, adminPages) ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    if (token.role !== "ADMIN") {
      return NextResponse.redirect(
        new URL("/auth/forbidden", request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|jb-logo.png).*)",
  ],
};
