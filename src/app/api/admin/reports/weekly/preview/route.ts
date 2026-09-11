import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { formatWeeklyReportForGoogleChat } from "@/lib/reports/weeklyReport";
import { generatePreviousWeekReport } from "@/lib/reports/weeklyReportService";

export async function GET() {
  try {
    const auth = await requireApiUser(["ADMIN"]);

    if (auth.response) {
      return auth.response;
    }

    const report = await generatePreviousWeekReport();
    const message = formatWeeklyReportForGoogleChat(report);

    return NextResponse.json({
      report,
      message,
    });
  } catch (error) {
    console.error("Failed to preview weekly report:", error);

    return NextResponse.json(
      { error: "Failed to generate weekly report" },
      { status: 500 }
    );
  }
}
