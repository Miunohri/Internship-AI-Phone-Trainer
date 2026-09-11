import { NextResponse } from "next/server";
import {
  getWeeklyReportSettings,
  updateWeeklyReportSettings,
  WeeklyReportValidationError,
} from "@/lib/reports/weeklyReportSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getWeeklyReportSettings();

    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load weekly report settings:", error);

    return NextResponse.json(
      { error: "Failed to load weekly report settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const settings = await updateWeeklyReportSettings(body);

    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof WeeklyReportValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("Failed to save weekly report settings:", error);

    return NextResponse.json(
      { error: "Failed to save weekly report settings." },
      { status: 500 }
    );
  }
}
