import { prisma } from "@/lib/prisma";

type ScorecardCriterionForPrompt = {
    id: string;
    name: string;
    description: string | null;
    maxScore: number;
};

export async function getActiveScorecardTemplate() {
    const template = await prisma.scorecardTemplate.findFirst({
        where: {
            isActive: true,
        },
        include: {
            criteria: {
                where: {
                    isActive: true,
                },
                orderBy: {
                    sortOrder: "asc",
                },
            },
        },
    });

    return template;
}

export function formatCriteriaForPrompt(criteria: ScorecardCriterionForPrompt[]) {
    return criteria.map((criterion) => {
        return `
        Criterion ID: ${criterion.id}
        Criterion: ${criterion.name}
        Description: ${criterion.description}
        Maximum Score: ${criterion.maxScore}
        `;
    }).join("\n");
}