import { timingSafeEqual } from "node:crypto";

function safeCompare(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return timingSafeEqual(firstBuffer, secondBuffer);
}

export function hasValidWeeklyReportSecret(request: Request): boolean {
  const configuredSecret = process.env.WEEKLY_REPORT_SECRET;

  if (!configuredSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-weekly-report-secret");

  const suppliedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : headerSecret;

  return suppliedSecret
    ? safeCompare(suppliedSecret, configuredSecret)
    : false;
}
