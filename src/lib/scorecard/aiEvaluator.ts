import { openai } from "../openai/openaiService";
import { buildScorecardPrompt } from "./promptBuilder";
import { scorecardSchema } from "./scorecardSchema";

type ScorecardCriterionForPrompt = {
    id: string;
    name: string;
    description: string | null;
    maxScore: number;
};

type ScorecardTemplateForPrompt = {
    criteria: ScorecardCriterionForPrompt[];
};

export async function evaluateTranscript(transcript: string, template: ScorecardTemplateForPrompt) {
    const prompt = buildScorecardPrompt(
        template.criteria,
        transcript,
        scorecardSchema
    );

    //console.log(prompt);

    const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        input: prompt,
    });

    const content = response.output_text;

    if(!content) {
        throw new Error("OpenAI returned an empty response");
    }

    try {
        return JSON.parse(content);
    }
    catch (error) {
        console.error("Invalid JSON from OpenAI:", content);
        throw error;
    }
}