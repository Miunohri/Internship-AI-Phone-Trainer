"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import {
    createPersona,
    createScenario,
    getAdminPersonas,
    updatePersona,
    updateScenario,
    type Persona,
    type Scenario,
} from "@/lib/api";

type NewPersonaForm = {
    name: string;
    description: string;
    openingLine: string;
    behavioralRules: string;
    primarySkills: string;
};

const initialNewPersonaForm: NewPersonaForm = {
    name: "",
    description: "",
    openingLine: "",
    behavioralRules: "",
    primarySkills: "",
};

type NewScenarioForm = {
    title: string;
    vehicle: string;
    concern: string;
    difficulty: string;
    promptNotes: string;
};

const initialNewScenarioForm: NewScenarioForm = {
    title: "",
    vehicle: "",
    concern: "",
    difficulty: "",
    promptNotes: "",
};

function sortPersonas(personas: Persona[]): Persona[] {
    return [...personas].sort((first, second) => {
        if (first.isActive !== second.isActive) {
            return first.isActive ? -1 : 1;
        }

        return first.name.localeCompare(second.name);
    });
}

export default function AdminPersonasPage() {
    const router = useRouter();
    const { data: authSession, status } = useSession();

    const [personas, setPersonas] = useState<Persona[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [newPersona, setNewPersona] = useState<NewPersonaForm>(
        initialNewPersonaForm
    );
    const [addingPersona, setAddingPersona] = useState(false);
    const [savingPersonaId, setSavingPersonaId] = useState<string | null>(null);

    const [newScenarioDrafts, setNewScenarioDrafts] = useState<Record<string, NewScenarioForm>>({});
    const [addingScenarioForPersonaId, setAddingScenarioForPersonaId] =
        useState<string | null>(null);
    const [savingScenarioId, setSavingScenarioId] = useState<string | null>(
        null
    );

    useEffect(() => {
        if (status === "loading") {
            return;
        }

        if (status === "unauthenticated") {
            router.replace("/");
            return;
        }

        if (authSession?.user?.role !== "ADMIN") {
            router.replace("/auth/forbidden");
            return;
        }

        getAdminPersonas()
            .then((data) => {
                setPersonas(
                    [...data].sort((a, b) => {
                        if (a.isActive !== b.isActive) {
                            return a.isActive ? -1 : 1;
                        }
                        return a.name.localeCompare(b.name);
                    })
                );
            })
            .catch(() => setError("Could not load personas."))
            .finally(() => setLoading(false));
    }, [authSession?.user?.role, router, status]);

    function updateLocalPersona(personaId: string, updates: Partial<Persona>) {
        setPersonas((current) =>
            current.map((persona) =>
                persona.id === personaId ? { ...persona, ...updates } : persona
            )
        );
    }

    function updateLocalScenario(
        personaId: string,
        scenarioId: string,
        updates: Partial<Scenario>
    ) {
        setPersonas((current) =>
            current.map((persona) => {
                if (persona.id !== personaId) return persona;

                return {
                    ...persona,
                    scenarios: (persona.scenarios ?? []).map((scenario) =>
                        scenario.id === scenarioId ? { ...scenario, ...updates } : scenario
                    ),
                };
            })
        );
    }

    async function savePersona(personaId: string, updates?: Partial<Persona>) {
        const current = personas.find((persona) => persona.id === personaId);
        if (!current) return;

        const payload = {
            name: updates?.name ?? current.name,
            description: updates?.description ?? current.description,
            openingLine: updates?.openingLine ?? current.openingLine ?? "",
            behavioralRules: updates?.behavioralRules ?? current.behavioralRules ?? "",
            primarySkills: updates?.primarySkills ?? current.primarySkills ?? "",
            isActive: updates?.isActive ?? current.isActive,
        };
        if (
            !payload.name.trim() ||
            !payload.description.trim() ||
            !payload.openingLine.trim() ||
            !payload.behavioralRules.trim()
        ) {
            setError(
                "Name, description, opening line, and behavioral rules are required."
            );
            return;
        }

        try {
            setError("");
            setSuccessMessage("");
            setSavingPersonaId(personaId);

            const saved = await updatePersona(personaId, payload);

            setPersonas((currentPersonas) =>
                sortPersonas(
                    currentPersonas.map((persona) =>
                        persona.id === saved.id ? saved : persona
                    )
                )
            );
            setSuccessMessage("Persona updated.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update persona.");
        } finally {
            setSavingPersonaId(null);
        }
    }

    async function saveScenario(
        personaId: string,
        scenarioId: string,
        updates?: Partial<Scenario>
    ) {
        const persona = personas.find((item) => item.id === personaId);
        const current = persona?.scenarios?.find((item) => item.id === scenarioId);
        if (!current) return;

        const payload = {
            title: updates?.title ?? current.title,
            vehicle: updates?.vehicle ?? current.vehicle ?? "",
            concern: updates?.concern ?? current.concern ?? "",
            difficulty: updates?.difficulty ?? current.difficulty ?? "",
            promptNotes: updates?.promptNotes ?? current.promptNotes ?? "",
            isActive: updates?.isActive ?? current.isActive,
        };

        if (!payload.title.trim()) {
            setError("Scenario title is required.");
            return;
        }

        try {
            setError("");
            setSuccessMessage("");
            setSavingScenarioId(scenarioId);

            const saved = await updateScenario(scenarioId, payload);

            setPersonas((currentPersonas) =>
                currentPersonas.map((item) => {
                    if (item.id !== personaId) return item;

                    return {
                        ...item,
                        scenarios: (item.scenarios ?? []).map((scenario) =>
                            scenario.id === saved.id ? saved : scenario
                        ),
                    };
                })
            );
            setSuccessMessage("Scenario updated.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update scenario.");
        } finally {
            setSavingScenarioId(null);
        }
    }

    async function handleAddPersona(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const payload = {
            name: newPersona.name.trim(),
            description: newPersona.description.trim(),
            openingLine: newPersona.openingLine.trim(),
            behavioralRules: newPersona.behavioralRules.trim(),
            primarySkills: newPersona.primarySkills.trim(),
        };

        if (!payload.name || !payload.description || !payload.openingLine || !payload.behavioralRules) {
            setError("Name, description, opening line, and behavioral rules are required.");
            return;
        }

        try {
            setError("");
            setSuccessMessage("");
            setAddingPersona(true);

            const created = await createPersona(payload);

            setPersonas((current) => sortPersonas([...current, created]));
            setNewPersona(initialNewPersonaForm);
            setSuccessMessage("Persona added.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add persona.");
        } finally {
            setAddingPersona(false);
        }
    }

    function getScenarioDraft(personaId: string): NewScenarioForm {
        return newScenarioDrafts[personaId] ?? initialNewScenarioForm;
    }

    function updateScenarioDraft(personaId: string, updates: Partial<NewScenarioForm>) {
        setNewScenarioDrafts((current) => ({
            ...current,
            [personaId]: { ...getScenarioDraft(personaId), ...updates },
        }));
    }

    async function handleAddScenario(personaId: string, event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const draft = getScenarioDraft(personaId);

        const payload = {
            title: draft.title.trim(),
            vehicle: draft.vehicle.trim(),
            concern: draft.concern.trim(),
            difficulty: draft.difficulty.trim(),
            promptNotes: draft.promptNotes.trim(),
        };

        if (!payload.title) {
            setError("Scenario title is required.");
            return;
        }

        try {
            setError("");
            setSuccessMessage("");
            setAddingScenarioForPersonaId(personaId);

            const created = await createScenario(personaId, payload);

            setPersonas((current) =>
                current.map((persona) =>
                    persona.id === personaId
                        ? { ...persona, scenarios: [...(persona.scenarios ?? []), created] }
                        : persona
                )
            );
            setNewScenarioDrafts((current) => ({
                ...current,
                [personaId]: initialNewScenarioForm,
            }));
            setSuccessMessage("Scenario added.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add scenario.");
        } finally {
            setAddingScenarioForPersonaId(null);
        }
    }
    async function handlePersonaActiveToggle(persona: Persona) {
        await savePersona(persona.id, {
            isActive: !persona.isActive,
        });
    }
    async function handleScenarioActiveToggle(
        personaId: string,
        scenario: Scenario
    ) {
        await saveScenario(personaId, scenario.id, {
            isActive: !scenario.isActive,
        });
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <NavBar />

            <main className="max-w-6xl mx-auto p-6">
                <div className="mb-6">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                        Admin
                    </p>
                    <h1 className="text-2xl font-bold text-[var(--jb-charcoal)]">
                        Personas &amp; Scenarios
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Manage the AI customer personas and the specific call scenarios
                        used in the randomized training flow. Deactivated personas and
                        scenarios remain in historical reporting but are excluded from
                        future randomized calls.
                    </p>
                </div>

                {error && (
                    <p className="bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg px-4 py-3 mb-4">
                        {error}
                    </p>
                )}

                {successMessage && (
                    <p className="bg-green-50 border border-green-200 text-sm text-green-700 rounded-lg px-4 py-3 mb-4">
                        {successMessage}
                    </p>
                )}

                <section className="bg-white rounded-lg shadow p-5 mb-6">
                    <h2 className="font-semibold text-[var(--jb-charcoal)] mb-4">Add Persona</h2>

                    <form onSubmit={handleAddPersona} className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Name
                            </label>
                            <input
                                value={newPersona.name}
                                onChange={(event) =>
                                    setNewPersona((current) => ({ ...current, name: event.target.value }))
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="e.g. Neville: Nervous First-Timer"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Primary Skills
                            </label>
                            <input
                                value={newPersona.primarySkills}
                                onChange={(event) =>
                                    setNewPersona((current) => ({
                                        ...current,
                                        primarySkills: event.target.value,
                                    }))
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="e.g. Tonality, investigative questions"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Description
                            </label>
                            <textarea
                                value={newPersona.description}
                                onChange={(event) =>
                                    setNewPersona((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                rows={2}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Short description of who this caller is."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Opening Line
                            </label>
                            <textarea
                                value={newPersona.openingLine}
                                onChange={(event) =>
                                    setNewPersona((current) => ({
                                        ...current,
                                        openingLine: event.target.value,
                                    }))
                                }
                                rows={2}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="What the AI customer says first on the call."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Behavioral Rules
                            </label>
                            <textarea
                                value={newPersona.behavioralRules}
                                onChange={(event) =>
                                    setNewPersona((current) => ({
                                        ...current,
                                        behavioralRules: event.target.value,
                                    }))
                                }
                                rows={2}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="How this persona should behave and respond during the call."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <button
                                type="submit"
                                disabled={addingPersona}
                                className="rounded-md bg-[var(--jb-navy)] text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                            >
                                {addingPersona ? "Adding..." : "Add Persona"}
                            </button>
                        </div>
                    </form>
                </section>

                {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                ) : personas.length === 0 ? (
                    <p className="text-sm text-slate-500">No personas found.</p>
                ) : (
                    <div className="space-y-6">
                        {personas.map((persona) => (
                            <section
                                key={persona.id}
                                className={`bg-white rounded-lg shadow overflow-hidden ${
                                    persona.isActive ? "" : "opacity-75"
                                }`}
                            >
                                <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                      <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              persona.isActive
                                  ? "bg-green-50 text-green-700"
                                  : "bg-slate-200 text-slate-600"
                          }`}
                      >
                        {persona.isActive ? "Active" : "Inactive"}
                      </span>
                                            {savingPersonaId === persona.id && (
                                                <span className="text-xs text-slate-400">Saving...</span>
                                            )}
                                        </div>

                                        <input
                                            value={persona.name}
                                            onChange={(event) =>
                                                updateLocalPersona(persona.id, { name: event.target.value })
                                            }
                                            className="w-full text-lg font-semibold text-[var(--jb-charcoal)] border border-transparent hover:border-slate-300 focus:border-slate-300 rounded-md px-2 py-1 -ml-2"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handlePersonaActiveToggle(persona)}
                                        className="whitespace-nowrap text-sm font-medium text-[var(--jb-navy)] hover:underline"
                                    >
                                        {persona.isActive ? "Deactivate" : "Reactivate"}
                                    </button>
                                </div>

                                <div className="px-5 py-4 grid gap-4 md:grid-cols-2 border-b border-slate-200">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                            Primary Skills
                                        </label>
                                        <input
                                            value={persona.primarySkills ?? ""}
                                            onChange={(event) =>
                                                updateLocalPersona(persona.id, {
                                                    primarySkills: event.target.value,
                                                })
                                            }
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                            Opening Line
                                        </label>
                                        <input
                                            value={persona.openingLine ?? ""}
                                            onChange={(event) =>
                                                updateLocalPersona(persona.id, {
                                                    openingLine: event.target.value,
                                                })
                                            }
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                            Description
                                        </label>
                                        <textarea
                                            value={persona.description}
                                            onChange={(event) =>
                                                updateLocalPersona(persona.id, {
                                                    description: event.target.value,
                                                })
                                            }
                                            rows={2}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                            Behavioral Rules
                                        </label>
                                        <textarea
                                            value={persona.behavioralRules ?? ""}
                                            onChange={(event) =>
                                                updateLocalPersona(persona.id, {
                                                    behavioralRules: event.target.value,
                                                })
                                            }
                                            rows={2}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <button
                                            type="button"
                                            onClick={() => void savePersona(persona.id)}
                                            disabled={savingPersonaId === persona.id}
                                            className="rounded-md bg-[var(--jb-navy)] text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                                        >
                                            {savingPersonaId === persona.id
                                                ? "Saving..."
                                                : "Save Persona"}
                                        </button>
                                    </div>
                                </div>

                                <div className="px-5 py-4">
                                    <h3 className="text-sm font-semibold text-[var(--jb-charcoal)] mb-3">
                                        Scenarios
                                    </h3>

                                    {(persona.scenarios ?? []).length === 0 ? (
                                        <p className="text-sm text-slate-500 mb-4">
                                            No scenarios yet for this persona.
                                        </p>
                                    ) : (
                                        <div className="space-y-3 mb-4">
                                            {(persona.scenarios ?? []).map((scenario) => (
                                                <div
                                                    key={scenario.id}
                                                    className={`rounded-md border border-slate-200 p-4 ${
                                                        scenario.isActive ? "" : "bg-slate-50 opacity-75"
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-4 mb-3">
                            <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                    scenario.isActive
                                        ? "bg-green-50 text-green-700"
                                        : "bg-slate-200 text-slate-600"
                                }`}
                            >
                              {scenario.isActive ? "Active" : "Inactive"}
                            </span>

                                                        <div className="flex items-center gap-3">
                                                            {savingScenarioId === scenario.id && (
                                                                <span className="text-xs text-slate-400">
                                  Saving...
                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleScenarioActiveToggle(persona.id, scenario)
                                                                }
                                                                className="text-sm font-medium text-[var(--jb-navy)] hover:underline"
                                                            >
                                                                {scenario.isActive ? "Deactivate" : "Reactivate"}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div>
                                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                                Title
                                                            </label>
                                                            <input
                                                                value={scenario.title}
                                                                onChange={(event) =>
                                                                    updateLocalScenario(persona.id, scenario.id, {
                                                                        title: event.target.value,
                                                                    })
                                                                }
                                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                                Vehicle
                                                            </label>
                                                            <input
                                                                value={scenario.vehicle ?? ""}
                                                                onChange={(event) =>
                                                                    updateLocalScenario(persona.id, scenario.id, {
                                                                        vehicle: event.target.value,
                                                                    })
                                                                }
                                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                                Difficulty
                                                            </label>
                                                            <input
                                                                value={scenario.difficulty ?? ""}
                                                                onChange={(event) =>
                                                                    updateLocalScenario(persona.id, scenario.id, {
                                                                        difficulty: event.target.value,
                                                                    })
                                                                }
                                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                                Customer Concern
                                                            </label>
                                                            <input
                                                                value={scenario.concern ?? ""}
                                                                onChange={(event) =>
                                                                    updateLocalScenario(persona.id, scenario.id, {
                                                                        concern: event.target.value,
                                                                    })
                                                                }
                                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                            />
                                                        </div>

                                                        <div className="md:col-span-2">
                                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                                Prompt Notes
                                                        <div className="md:col-span-2">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void saveScenario(
                                                                        persona.id,
                                                                        scenario.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    savingScenarioId ===
                                                                    scenario.id
                                                                }
                                                                className="rounded-md bg-[var(--jb-navy)] text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                                                            >
                                                                {savingScenarioId === scenario.id
                                                                    ? "Saving..."
                                                                    : "Save Scenario"}
                                                            </button>
                                                        </div>
                                                            </label>
                                                            <textarea
                                                                value={scenario.promptNotes ?? ""}
                                                                onChange={(event) =>
                                                                    updateLocalScenario(persona.id, scenario.id, {
                                                                        promptNotes: event.target.value,
                                                                    })
                                                                }
                                                                rows={2}
                                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <details className="rounded-md border border-dashed border-slate-300 p-4">
                                        <summary className="text-sm font-semibold text-[var(--jb-navy)] cursor-pointer">
                                            Add Scenario
                                        </summary>

                                        <form
                                            onSubmit={(event) => handleAddScenario(persona.id, event)}
                                            className="grid gap-3 md:grid-cols-2 mt-4"
                                        >
                                            <div>
                                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                    Title
                                                </label>
                                                <input
                                                    value={getScenarioDraft(persona.id).title}
                                                    onChange={(event) =>
                                                        updateScenarioDraft(persona.id, { title: event.target.value })
                                                    }
                                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                    placeholder="e.g. Referral with Audi maintenance concern"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                    Vehicle
                                                </label>
                                                <input
                                                    value={getScenarioDraft(persona.id).vehicle}
                                                    onChange={(event) =>
                                                        updateScenarioDraft(persona.id, { vehicle: event.target.value })
                                                    }
                                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                    placeholder="e.g. 2021 Porsche Macan"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                    Difficulty
                                                </label>
                                                <input
                                                    value={getScenarioDraft(persona.id).difficulty}
                                                    onChange={(event) =>
                                                        updateScenarioDraft(persona.id, {
                                                            difficulty: event.target.value,
                                                        })
                                                    }
                                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                    placeholder="Easy / Medium / Hard"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                    Customer Concern
                                                </label>
                                                <input
                                                    value={getScenarioDraft(persona.id).concern}
                                                    onChange={(event) =>
                                                        updateScenarioDraft(persona.id, { concern: event.target.value })
                                                    }
                                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                                    Prompt Notes
                                                </label>
                                                <textarea
                                                    value={getScenarioDraft(persona.id).promptNotes}
                                                    onChange={(event) =>
                                                        updateScenarioDraft(persona.id, {
                                                            promptNotes: event.target.value,
                                                        })
                                                    }
                                                    rows={2}
                                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <button
                                                    type="submit"
                                                    disabled={addingScenarioForPersonaId === persona.id}
                                                    className="rounded-md bg-[var(--jb-navy)] text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                                                >
                                                    {addingScenarioForPersonaId === persona.id
                                                        ? "Adding..."
                                                        : "Add Scenario"}
                                                </button>
                                            </div>
                                        </form>
                                    </details>
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
