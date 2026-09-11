import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { sendGoogleChatMessage } from "@/lib/reports/googleChat";
import { formatWeeklyReportForGoogleChat } from "@/lib/reports/weeklyReport";
import { generatePreviousWeekReport } from "@/lib/reports/weeklyReportService";

export async function POST() {
  try {
    const auth = await requireApiUser(["ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const report = await generatePreviousWeekReport();
    const message = formatWeeklyReportForGoogleChat(report);
    const googleChatResponse = await sendGoogleChatMessage(message);

    return NextResponse.json({
      success: true,
      report,
      message,
      googleChatResponse,
    });
  } catch (error) {
    console.error("Failed to send weekly report:", error);

    return NextResponse.json(
      { error: "Failed to send weekly report." },
      { status: 500 }
    );
  }
}
