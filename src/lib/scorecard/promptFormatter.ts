type ScorecardCriterionForPrompt = {
    id: string;
    name: string;
    description: string | null;
    maxScore: number;
};

export function formatCriteriaForPrompt(criteria: ScorecardCriterionForPrompt[]) {
    if (!criteria || criteria.length == 0) {
        throw new Error("No scoring criteria provided");
    }

    return criteria.map((criterion) => {
        return `
        Criterion ID (must be returned exactly): ${criterion.id}
        Criterion: ${criterion.name}
        Description: ${criterion.description}
        Maximum Score: ${criterion.maxScore}
        `;
    }).join("\n");
}