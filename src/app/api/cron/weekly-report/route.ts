import { NextResponse } from "next/server";
import { sendGoogleChatMessage } from "@/lib/reports/googleChat";
import { formatWeeklyReportForGoogleChat } from "@/lib/reports/weeklyReport";
import { hasValidWeeklyReportSecret } from "@/lib/reports/weeklyReportAuth";
import { generatePreviousWeekReport } from "@/lib/reports/weeklyReportService";
import { getWeeklyReportSettings } from "@/lib/reports/weeklyReportSettings";

async function runWeeklyReport(request: Request) {
  if (!hasValidWeeklyReportSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const settings = await getWeeklyReportSettings();

    if (!settings.enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Automatic weekly reports are disabled.",
      });
    }

    const report = await generatePreviousWeekReport();
    const message = formatWeeklyReportForGoogleChat(report);
    const googleChatResponse = await sendGoogleChatMessage(message);

    return NextResponse.json({
      success: true,
      skipped: false,
      period: report.period,
      googleChatResponse,
    });
  } catch (error) {
    console.error("Scheduled weekly report failed:", error);

    return NextResponse.json(
      { error: "Scheduled weekly report failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return runWeeklyReport(request);
}

export async function POST(request: Request) {
  return runWeeklyReport(request);
}
