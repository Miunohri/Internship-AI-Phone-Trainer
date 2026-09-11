import { NextResponse } from "next/server";
import {
  BrandingValidationError,
  readBranding,
  writeBranding,
} from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const branding = await readBranding();

    return NextResponse.json(branding, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load branding settings:", error);

    return NextResponse.json(
      { error: "Failed to load branding settings." },
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
    const updated = await writeBranding(body);

    return NextResponse.json(updated, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof BrandingValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("Failed to save branding settings:", error);

    return NextResponse.json(
      { error: "Failed to save branding settings." },
      { status: 500 }
    );
  }
}
