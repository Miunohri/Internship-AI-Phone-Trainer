import { NextResponse } from "next/server";
import {
  getScorecardCriteria,
  saveScorecardCriteria,
} from "@/lib/scorecard/scorecardAdminService";
import {
  ScorecardValidationError,
  validateScorecardCriteria,
} from "@/lib/scorecard/scorecardValidation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const criteria = await getScorecardCriteria();

    return NextResponse.json(criteria, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load scorecard settings:", error);

    return NextResponse.json(
      { error: "Failed to load scorecard settings." },
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
    const criteria = validateScorecardCriteria(body);
    const updatedCriteria = await saveScorecardCriteria(criteria);

    return NextResponse.json(updatedCriteria, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ScorecardValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("Failed to save scorecard settings:", error);

    return NextResponse.json(
      { error: "Failed to save scorecard settings." },
      { status: 500 }
    );
  }
}
