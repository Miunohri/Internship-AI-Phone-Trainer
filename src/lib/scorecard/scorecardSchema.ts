export const scorecardSchema = `json
{
    "schemaVersion": "1.0",
    "totalScore": 0,
    "maxScore": 0,
    "summary": "Brief summary of the advisor's overall performance.",
    "actionPlan": "1. Improve greeting and introduction.\n2. Ask additional questions to better understand the customer's concern.\n3. Confirm next steps before ending the call.",
    "criteria": [
        {
            "criterionId": "string",
            "name": "string",
            "score": 0,
            "maxScore": 0,
            "feedback": "string",
            "evidence": "string"
        }
    ]
}
`;