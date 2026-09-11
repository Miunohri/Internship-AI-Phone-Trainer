import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set in .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminUser = await prisma.user.upsert({
    where: { email: "test.admin@auto.local" },
    update: {
      name: "Test Admin",
      role: "ADMIN",
    },
    create: {
      name: "Test Admin",
      email: "Test.admin@auto.local",
      role: "ADMIN",
    },
  });

  const demoAdvisor = await prisma.user.upsert({
    where: { email: "demo.advisor@auto.local" },
    update: {
      name: "Demo Advisor",
      role: "ADVISOR",
    },
    create: {
      name: "Demo Advisor",
      email: "demo.advisor@auto.local",
      role: "ADVISOR",
    },
  });

  const personas = [
    {
      oldName: "Nervous First-Timer",
      name: "Neville: Nervous First-Timer",
      description:
        "A new client who is unsure, anxious, and needs reassurance before scheduling.",
      openingLine:
        "Hi, I've never been to your shop before, but my car has been making a noise and I'm not really sure what to do.",
      behavioralRules:
        "Act uncertain and cautious. Ask whether the shop is trustworthy. Respond well when the advisor is patient, reassuring, and clear.",
      primarySkills: "Tone, reassurance, investigative questions, appointment ask",
      scenario: {
        oldTitle: "New client with unknown noise",
        title: "New Porsche owner with unknown noise",
        vehicle: "2021 Porsche Macan",
        concern: "The vehicle is making a new noise while driving.",
        difficulty: "Easy",
        promptNotes:
          "The customer is nervous and needs help understanding the next step. This is their first European/specialty vehicle, so some of the anxiety is about whether an independent shop can be trusted with it. The advisor should reassure them that JB Import Auto specializes in vehicles like this.",
      },
    },
    {
      oldName: "Price Shopper",
      name: "Penny: Price Shopper",
      description:
        "A caller focused heavily on price and comparing the shop to other options.",
      openingLine:
        "Hi, I'm calling around to get prices. How much do you charge for brakes?",
      behavioralRules:
        "Focus on price early. Push for a quick number. Respond better when the advisor builds value and explains why inspection is needed before quoting.",
      primarySkills: "Building value, controlling the call, appointment ask",
      scenario: {
        oldTitle: "Brake price shopper",
        title: "VW brake price shopper",
        vehicle: "2019 Volkswagen Golf GTI",
        concern: "Customer wants a price for brakes without diagnostic information.",
        difficulty: "Medium",
        promptNotes:
          "The advisor should avoid blindly quoting and should explain the value of inspection, especially the parts, labor, and diagnostic differences for a European vehicle versus a generic quote from a general repair shop.",
      },
    },
    {
      oldName: "Storyteller",
      name: "Silas: Storyteller",
      description:
        "A caller who gives a lot of extra background and can pull the advisor off track.",
      openingLine:
        "Hi, I'm calling about my car. It's kind of a long story, but this started a few months ago after I took a trip.",
      behavioralRules:
        "Give long answers and extra details. The advisor should listen but guide the conversation back to useful facts.",
      primarySkills: "Active listening, call control, investigative questions",
      scenario: {
        oldTitle: "Long story intermittent issue",
        title: "Land Rover long story intermittent issue",
        vehicle: "2017 Land Rover Range Rover Sport",
        concern: "Intermittent warning light and drivability concern.",
        difficulty: "Medium",
        promptNotes:
          "The advisor should acknowledge the story, gather key facts, and move toward scheduling. Genuine enthusiasm about the vehicle can help build rapport and pull the conversation back on track.",
      },
    },
    {
      oldName: "Rushed Professional",
      name: "Roxanne: Rushed Professional",
      description:
        "A busy caller who wants quick answers and has limited patience.",
      openingLine:
        "Hi, I'm between meetings. My car is acting up and I need to know if you can get me in quickly.",
      behavioralRules:
        "Sound rushed and impatient. Keep answers short. Respond well to clear, efficient questions and appointment options.",
      primarySkills: "Efficiency, confidence, appointment ask",
      scenario: {
        oldTitle: "Busy client needs quick scheduling",
        title: "Busy BMW owner needs quick scheduling",
        vehicle: "2022 BMW X5",
        concern: "Vehicle is shaking at highway speeds.",
        difficulty: "Medium",
        promptNotes:
          "The advisor should be concise, helpful, and direct. The caller does not have time for small talk, but a brief, confident mention of BMW expertise can still help build trust.",
      },
    },
    {
      oldName: "Skeptic",
      name: "Scully: Skeptic",
      description:
        "A caller who is guarded because of a bad prior repair experience.",
      openingLine:
        "Hi, I'm looking for a shop, but I'll be honest, I've had bad experiences before with repair places.",
      behavioralRules:
        "Be doubtful and ask trust-based questions. Respond well when the advisor explains process, transparency, and value.",
      primarySkills: "Trust building, empathy, process explanation",
      scenario: {
        oldTitle: "Skeptical new client",
        title: "Skeptical Mercedes-Benz owner",
        vehicle: "2016 Mercedes-Benz E350",
        concern: "Check engine light is on.",
        difficulty: "Hard",
        promptNotes:
          "The advisor should build trust without sounding defensive or dismissive. The prior bad experience was at a shop unfamiliar with Mercedes-Benz vehicles, so specialty expertise is a meaningful trust point here.",
      },
    },
    {
      oldName: "Loyal Referral",
      name: "Laura: Loyal Referral",
      description:
        "A caller referred by an existing customer and already somewhat warm to the shop.",
      openingLine:
        "Hi, my friend told me to call you guys. They said you took good care of their car.",
      behavioralRules:
        "Be friendly and open. Mention the referral. The advisor should reinforce trust and move smoothly toward scheduling.",
      primarySkills: "Relationship building, gathering information, appointment ask",
      scenario: {
        oldTitle: "Referral with maintenance concern",
        title: "Referral with Audi maintenance concern",
        vehicle: "2020 Audi Q5",
        concern: "Customer is due for service and has a small oil leak concern.",
        difficulty: "Easy",
        promptNotes:
          "The advisor should acknowledge the referral and convert the call into an appointment. Some genuine enthusiasm about working on Audis fits naturally here since the call is already warm.",
      },
    },
  ] as const;

  for (const personaData of personas) {
    const matchingPersonas = await prisma.persona.findMany({
      where: {
        name: {
          in: [personaData.oldName, personaData.name],
        },
      },
    });

    const preferredPersona =
      matchingPersonas.find((persona) => persona.name === personaData.name) ??
      matchingPersonas.find((persona) => persona.name === personaData.oldName);

    const persona = preferredPersona
      ? await prisma.persona.update({
          where: { id: preferredPersona.id },
          data: {
            name: personaData.name,
            description: personaData.description,
            openingLine: personaData.openingLine,
            behavioralRules: personaData.behavioralRules,
            primarySkills: personaData.primarySkills,
            isActive: true,
          },
        })
      : await prisma.persona.create({
          data: {
            name: personaData.name,
            description: personaData.description,
            openingLine: personaData.openingLine,
            behavioralRules: personaData.behavioralRules,
            primarySkills: personaData.primarySkills,
            isActive: true,
          },
        });

    const duplicatePersonaIds = matchingPersonas
      .filter((matchingPersona) => matchingPersona.id !== persona.id)
      .map((matchingPersona) => matchingPersona.id);

    if (duplicatePersonaIds.length > 0) {
      await prisma.persona.updateMany({
        where: {
          id: {
            in: duplicatePersonaIds,
          },
        },
        data: {
          isActive: false,
        },
      });
    }

    const scenarioData = personaData.scenario;

    const matchingScenarios = await prisma.scenario.findMany({
      where: {
        personaId: persona.id,
        title: {
          in: [scenarioData.oldTitle, scenarioData.title],
        },
      },
    });

    const preferredScenario =
      matchingScenarios.find((scenario) => scenario.title === scenarioData.title) ??
      matchingScenarios.find((scenario) => scenario.title === scenarioData.oldTitle);

    const scenario = preferredScenario
      ? await prisma.scenario.update({
          where: { id: preferredScenario.id },
          data: {
            title: scenarioData.title,
            type: "INBOUND",
            vehicle: scenarioData.vehicle,
            concern: scenarioData.concern,
            difficulty: scenarioData.difficulty,
            promptNotes: scenarioData.promptNotes,
            isActive: true,
          },
        })
      : await prisma.scenario.create({
          data: {
            personaId: persona.id,
            title: scenarioData.title,
            type: "INBOUND",
            vehicle: scenarioData.vehicle,
            concern: scenarioData.concern,
            difficulty: scenarioData.difficulty,
            promptNotes: scenarioData.promptNotes,
            isActive: true,
          },
        });

    const duplicateScenarioIds = matchingScenarios
      .filter((matchingScenario) => matchingScenario.id !== scenario.id)
      .map((matchingScenario) => matchingScenario.id);

    if (duplicateScenarioIds.length > 0) {
      await prisma.scenario.updateMany({
        where: {
          id: {
            in: duplicateScenarioIds,
          },
        },
        data: {
          isActive: false,
        },
      });
    }
  }

  const templateName = "JB Import Auto Inbound Phone Scorecard";

  let scorecardTemplate = await prisma.scorecardTemplate.findFirst({
    where: { name: templateName },
  });

  if (!scorecardTemplate) {
    scorecardTemplate = await prisma.scorecardTemplate.create({
      data: {
        name: templateName,
        description:
          "Initial inbound phone training scorecard based on JB Import Auto phone standards.",
        isActive: true,
      },
    });
  } else {
    scorecardTemplate = await prisma.scorecardTemplate.update({
      where: { id: scorecardTemplate.id },
      data: {
        description:
          "Initial inbound phone training scorecard based on JB Import Auto phone standards.",
        isActive: true,
      },
    });
  }

  const criteria = [
    {
      name: "Investigative Questions",
      description:
        "Advisor asks useful questions about the customer, vehicle, concern, symptoms, timing, and safety issues.",
      maxScore: 5,
      weight: 1,
      sortOrder: 1,
    },
    {
      name: "Helpful Tonality",
      description:
        "Advisor sounds professional, calm, friendly, confident, and helpful throughout the call.",
      maxScore: 5,
      weight: 1,
      sortOrder: 2,
    },
    {
      name: "Building Value",
      description:
        "Advisor explains the value of the shop, the inspection process, and why the next step is worthwhile.",
      maxScore: 5,
      weight: 1,
      sortOrder: 3,
    },
    {
      name: "Asking for Customer Name",
      description:
        "Advisor gets the customer's name and uses it appropriately during the call.",
      maxScore: 5,
      weight: 1,
      sortOrder: 4,
    },
    {
      name: "Appointment Ask",
      description:
        "Advisor clearly asks for the appointment and offers a next step instead of leaving the call unresolved.",
      maxScore: 5,
      weight: 1,
      sortOrder: 5,
    },
  ] as const;

  for (const criterion of criteria) {
    await prisma.scorecardCriterion.upsert({
      where: {
        templateId_sortOrder: {
          templateId: scorecardTemplate.id,
          sortOrder: criterion.sortOrder,
        },
      },
      update: {
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        isActive: true,
      },
      create: {
        templateId: scorecardTemplate.id,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        sortOrder: criterion.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("Seed data created:");
  console.log(`- Admin user: ${adminUser.email}`);
  console.log(`- Demo advisor: ${demoAdvisor.email}`);
  console.log(`- Personas: ${personas.length}`);
  console.log(`- Scorecard template: ${scorecardTemplate.name}`);
  console.log(`- Criteria: ${criteria.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });