import { formatCriteriaForPrompt } from "./promptFormatter";

type ScorecardCriterionForPrompt = {
    id: string;
    name: string;
    description: string | null;
    maxScore: number;
};

export function buildScorecardPrompt(
    criteria: ScorecardCriterionForPrompt[],
    transcript: string,
    schema: string
) {
    const formattedCriteria = formatCriteriaForPrompt(criteria);

    return `
    You are evaluating a phone call between an automotive service advisor and a customer. 
    
    When evaluating the call, consider these best practices:
    - Speaks clearly
    - Uses simple language
    - Reinforces trust
    - Explains why the service is needed
    - Explains the consequences of delaying
    - Presents value before price
    - Ties recommendations back to the customer's concerns
    - Doesn't apologize for the cost

    Evaluate the advisor using the following scoring criteria:
    ${formattedCriteria}

    Score each criterion independently. Evaluate only the behaviors relevant to that criterion. Do not let performance in one criterion influence the score assigned to another criterion.

    For each criterion, assign a score based on the maximum score provided:
    - The criterion description defines what the behavior requires. A high score should reflect how completely the advisor fulfilled the behavior described by the criterion, not merely whether they demonstrated one component of it.
    - A score equal to the criterion's maximum score indicates excellent performance. Reserve the maximum score for complete, consistent, and high-quality execution of the behavior described by the criterion, with little or no meaningful omission.
    - A score near the maximum indicates strong performance. The advisor demonstrated the behavior effectively but had minor omissions, inconsistencies, or missed opportunities that prevent the performance from being considered excellent.
    - A middle-range score indicates adequate performance. The advisor demonstrated basic behavior, but the execution was limited, inconsistent, or missing important elements.
    - A lower score above 1 indicates weak performance. The advisor demonstrated only a limited portion of the behavior or had significant omissions.
    - A score of 1 indicates the behavior was not demonstrated in the transcript.
    - Do not assign a score higher than the maximum score provided for the criterion.
    - Do not assign the maximum score simply because the advisor demonstrated the behavior at least once. The maximum score requires complete and consistently strong execution.
    - Do not assign a high score when the advisor demonstrates only a basic or partial version of the behavior.
    - Apply these performance levels relative to the criterion's configured maximum score so that the scoring remains valid if criteria or maximum scores are changed.
    - Do not assign a low score solely because the transcript does not contain enough information to evaluate the behavior.

    Conversation transcript: 
    ${transcript}

    For each criterion, provide: 
    - The assigned score
    - Specific feedback
    - Evidence from the transcript that supports the score. Only use evidence that appears in the provided transcript. Do not assume actions or behaviors that are not shown. If a behavior cannot be evaluated from the transcript, indicate that there is insufficient evidence rather than assuming it occurred. Lack of evidence does not automatically mean poor performance. Score only based on observed behavior.

    Each criterion in the output must correspond to exactly one criterion from the input.

    Use the exact criterionId associated with that criterion. Do not create new criterionIds. Do not replace criterionIds with names. Do not return "[object Object]" or any other placeholder.

    For the actionPlan field:
    - Provide a concise list of specific improvement steps for the advisor.
    - Format the action plan as numbered items separated by newline characters.
    - Each item should describe one actionable behavior the advisor can improve.
    - Do not write the action plan as a paragraph.
    - Tie recommendations directly to behaviors observed in the transcript.
    - Only include improvements supported by the evaluation. Do not invent issues that are not demonstrated in the transcript.

    All numeric fields must be numbers, not strings. Do not return numbers inside quotation marks. The score for each criterion must be an integer between 1 and the criterion's maxScore.

    Return only the JSON object. Do not wrap the response in markdown or code fences. Do not include any explanation before or after the JSON. 
    
    The JSON must follow this schema: 
    ${schema}
    `;
}