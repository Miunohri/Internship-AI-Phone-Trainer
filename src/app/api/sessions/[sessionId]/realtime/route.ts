import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { requireSessionAccess } from "@/lib/sessionAuth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

function buildVoiceInstructions(
  persona: Parameters<typeof buildSystemPrompt>[0],
  scenario: Parameters<typeof buildSystemPrompt>[1]
) {
  return `${buildSystemPrompt(persona, scenario)}

Voice-call rules:
- Respond only as the customer speaking on the phone.
- Use natural spoken language rather than written formatting.
- Keep most responses to one or two short sentences.
- Do not use markdown, lists, headings, stage directions, or narration.
- Do not describe your tone, emotions, gestures, or actions.
- Allow the service advisor to guide the conversation.
- Do not repeat the same information unless the advisor asks you to clarify.
- If interrupted, stop speaking and respond naturally to what the advisor says.
- Wait for the service advisor to greet you before beginning the scenario.`;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const access = await requireSessionAccess(sessionId);

    if (access.response) {
      return access.response;
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/sdp")) {
      return NextResponse.json(
        { error: "Content-Type must be application/sdp" },
        { status: 415 }
      );
    }

    const sdpOffer = await request.text();

    if (!sdpOffer.trim()) {
      return NextResponse.json(
        { error: "An SDP offer is required" },
        { status: 400 }
      );
    }

    const trainingSession = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        persona: {
          include: {
            scenarios: true,
          },
        },
        scenario: true,
      },
    });

    if (!trainingSession) {
      return NextResponse.json(
        { error: "Training session not found" },
        { status: 404 }
      );
    }

    if (trainingSession.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Training session is not in progress" },
        { status: 409 }
      );
    }

    const realtimeSession = {
      type: "realtime",
      model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1",
      output_modalities: ["audio"],
      instructions: buildVoiceInstructions(
        trainingSession.persona,
        trainingSession.scenario
      ),
      audio: {
        input: {
          noise_reduction: {
            type: "near_field",
          },
          transcription: {
            model:
              process.env.OPENAI_TRANSCRIPTION_MODEL ??
              "gpt-4o-mini-transcribe",
            language: "en",
            prompt:
              "Automotive service phone call. The repair shop is JB Import Auto. Accurately transcribe vehicle makes, models, symptoms, repairs, and service terminology.",
          },
          turn_detection: {
            type: "semantic_vad",
            eagerness: "medium",
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice: process.env.OPENAI_REALTIME_VOICE ?? "marin",
        },
      },
    };

    const formData = new FormData();
    formData.set("sdp", sdpOffer);
    formData.set("session", JSON.stringify(realtimeSession));

    const safetyIdentifier = createHash("sha256")
      .update(trainingSession.userId)
      .digest("hex");

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/realtime/calls",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Safety-Identifier": safetyIdentifier,
        },
        body: formData,
        cache: "no-store",
      }
    );

    const responseBody = await openAiResponse.text();

    if (!openAiResponse.ok) {
      console.error(
        "OpenAI Realtime session creation failed:",
        openAiResponse.status,
        responseBody
      );

      return NextResponse.json(
        { error: "Failed to create the realtime voice connection" },
        { status: 502 }
      );
    }

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to create realtime voice session:", error);

    return NextResponse.json(
      { error: "Failed to create realtime voice session" },
      { status: 500 }
    );
  }
}
