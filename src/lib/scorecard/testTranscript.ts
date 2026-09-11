// Sample transcript used for local testing

import { TranscriptTurnRequest } from "@/types/training";

export const testTranscript: TranscriptTurnRequest[] = [
    {
        speaker: "AI_CUSTOMER",
        text: "Hi, my car has been making a strange noise."
    },
    {
        speaker: "ADVISOR",
        text: "I'm sorry you're dealing with that. Can I get your name?"
    },
    {
        speaker: "AI_CUSTOMER",
        text: "It's Sarah."
    },
    {
        speaker: "ADVISOR",
        text: "When did you first notice the noise?"
    },
];