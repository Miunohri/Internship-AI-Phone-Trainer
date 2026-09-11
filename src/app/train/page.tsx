"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import {
  createSession,
  getPersonas,
  type Persona,
  type Scenario,
} from "@/lib/api";

type TrainingOption = {
  persona: Persona;
  scenario: Scenario;
};

function getActiveScenarios(persona: Persona) {
  return (persona.scenarios ?? []).filter((scenario) => scenario.isActive !== false);
}

function getTrainingOptions(personas: Persona[]): TrainingOption[] {
  return personas.flatMap((persona) =>
    getActiveScenarios(persona).map((scenario) => ({
      persona,
      scenario,
    }))
  );
}

function pickRandomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export default function TrainPage() {
  const router = useRouter();
  const { data: authSession, status } = useSession();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" || !authSession?.user?.id) {
      router.replace("/");
      return;
    }

    getPersonas()
      .then((all) => {
        setPersonas(
          all.filter((persona) => persona.isActive !== false)
        );
      })
      .catch(() => setError("Could not load personas."))
      .finally(() => setLoading(false));
  }, [authSession?.user?.id, router, status]);

  function pickPersona(persona: Persona) {
    setSelectedPersona(persona);

    const scenarios = getActiveScenarios(persona);
    setSelectedScenario(scenarios.length === 1 ? scenarios[0] : null);
  }

  async function createTrainingSession(
    persona: Persona,
    scenario: Scenario
  ) {
    if (!authSession?.user?.id) {
      router.replace("/");
      return;
    }

    setStarting(true);
    setError("");

    try {
      const trainingSession = await createSession({
        userId: authSession.user.id,
        personaId: persona.id,
        scenarioId: scenario.id,
        channel: "BROWSER",
      });

      router.push(`/call/${trainingSession.id}`);
    } catch {
      setError(
        "Could not start the session. Check the API and try again."
      );
      setStarting(false);
    }
  }

  async function startRandomCall() {
    const eligiblePersonas = personas.filter(
      (persona) => getActiveScenarios(persona).length > 0
    );

    if (eligiblePersonas.length === 0) {
      setError("No active training scenarios are available.");
      return;
    }

    const persona = pickRandomItem(eligiblePersonas);
    const scenarios = getActiveScenarios(persona);
    const scenario = pickRandomItem(scenarios);

    await createTrainingSession(persona, scenario);
  }

  async function startSelectedCall() {
    if (!selectedPersona || !selectedScenario) return;
    await createTrainingSession(selectedPersona, selectedScenario);
  }

  const canUseManualControls =
    authSession?.user?.role === "MANAGER" ||
    authSession?.user?.role === "ADMIN";

  const scenarios = selectedPersona ? getActiveScenarios(selectedPersona) : [];
  const trainingOptions = getTrainingOptions(personas);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <main className="max-w-4xl mx-auto p-6">
        <section className="bg-white rounded-lg shadow p-6 mb-6 border-t-4 border-[var(--jb-navy)]">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Advisor Training
          </p>

          <h1 className="text-2xl font-bold text-[var(--jb-charcoal)] mb-2">
            Start a Random Training Call
          </h1>

          <p className="text-sm text-slate-500 mb-5">
            The app will randomly choose a customer persona and repair scenario.
            The advisor will not know which customer type they are getting until
            the call begins.
          </p>

          {loading && <p className="text-sm text-slate-500">Loading training scenarios...</p>}
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          {!loading && trainingOptions.length === 0 && !error && (
            <p className="text-sm text-slate-500 mb-4">
              No active training scenarios are available. Check that the seed data
              has been loaded.
            </p>
          )}

          <button
            onClick={startRandomCall}
            disabled={loading || trainingOptions.length === 0 || starting}
            className="bg-[var(--jb-navy)] hover:opacity-90 disabled:bg-slate-300 text-white font-medium px-6 py-2 rounded transition-opacity"
          >
            {starting ? "Starting..." : "Begin Random Call"}
          </button>
        </section>

        {canUseManualControls && (
          <section className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Manager/Admin Testing
              </p>

              <h2 className="text-xl font-bold text-[var(--jb-charcoal)] mb-2">
                Manual Scenario Selection
              </h2>

              <p className="text-sm text-slate-500">
                Managers and admins can manually choose personas and scenarios for
                testing. Normal advisor training uses the random call flow above.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => pickPersona(persona)}
                  className={`text-left bg-white rounded-lg shadow-sm p-5 border-2 transition ${
                    selectedPersona?.id === persona.id
                      ? "border-[var(--jb-navy)] bg-blue-50"
                      : "border-slate-200 hover:border-[var(--jb-blue)]"
                  }`}
                >
                  <h3 className="font-semibold text-[var(--jb-charcoal)] mb-1">
                    {persona.name}
                  </h3>
                  <p className="text-sm text-slate-500">{persona.description}</p>
                </button>
              ))}
            </div>

            {selectedPersona && (
              <section className="border border-slate-200 rounded-lg p-5 mb-6">
                <h3 className="font-semibold text-[var(--jb-charcoal)] mb-3">
                  Choose a Scenario
                </h3>

                {scenarios.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No scenarios found for this persona. The personas route may
                    need to include scenarios.
                  </p>
                )}

                <div className="space-y-2">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => setSelectedScenario(scenario)}
                      className={`w-full text-left px-4 py-3 rounded border transition ${
                        selectedScenario?.id === scenario.id
                          ? "border-[var(--jb-navy)] bg-blue-50"
                          : "border-slate-200 hover:border-[var(--jb-blue)]"
                      }`}
                    >
                      <p className="text-sm font-medium text-[var(--jb-charcoal)]">
                        {scenario.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[scenario.vehicle, scenario.concern, scenario.difficulty]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <button
              onClick={startSelectedCall}
              disabled={!selectedPersona || !selectedScenario || starting}
              className="bg-[var(--jb-navy)] hover:opacity-90 disabled:bg-slate-300 text-white font-medium px-6 py-2 rounded transition-opacity"
            >
              {starting ? "Starting..." : "Begin Selected Call"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
