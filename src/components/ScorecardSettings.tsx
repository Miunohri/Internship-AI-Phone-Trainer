"use client";

import { useEffect, useState } from "react";

type ScorecardCriterionResponse = {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
  sortOrder: number;
  isActive: boolean;
};

type EditableCriterion = {
  clientKey: string;
  id: string | null;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
  isActive: boolean;
};

function toEditableCriterion(
  criterion: ScorecardCriterionResponse
): EditableCriterion {
  return {
    clientKey: criterion.id,
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    maxScore: criterion.maxScore,
    weight: criterion.weight,
    isActive: criterion.isActive,
  };
}

function createNewCriterion(): EditableCriterion {
  return {
    clientKey: `new-${Date.now()}-${Math.random()}`,
    id: null,
    name: "",
    description: "",
    maxScore: 5,
    weight: 1,
    isActive: true,
  };
}

export default function ScorecardSettings() {
  const [criteria, setCriteria] = useState<EditableCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/settings/scorecard", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load scorecard settings.");
        }

        return (await response.json()) as ScorecardCriterionResponse[];
      })
      .then((data) => setCriteria(data.map(toEditableCriterion)))
      .catch(() => setError("Could not load scorecard settings."))
      .finally(() => setLoading(false));
  }, []);

  function updateCriterion(
    clientKey: string,
    field: keyof Omit<EditableCriterion, "clientKey" | "id">,
    value: string | number | boolean
  ) {
    setSuccess("");

    setCriteria((current) =>
      current.map((criterion) =>
        criterion.clientKey === clientKey
          ? {
              ...criterion,
              [field]: value,
            }
          : criterion
      )
    );
  }

  function addCriterion() {
    setCriteria((current) => [...current, createNewCriterion()]);
    setSuccess("");
    setError("");
  }

  function moveCriterion(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= criteria.length) {
      return;
    }

    setCriteria((current) => {
      const reordered = [...current];
      const [criterion] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, criterion);
      return reordered;
    });

    setSuccess("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = criteria.map((criterion) => ({
        id: criterion.id,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        isActive: criterion.isActive,
      }));

      const response = await fetch("/api/settings/scorecard", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as
        | ScorecardCriterionResponse[]
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in body && body.error
            ? body.error
            : "Could not save scorecard settings."
        );
      }

      const updated = body as ScorecardCriterionResponse[];
      setCriteria(updated.map(toEditableCriterion));
      setSuccess("Scorecard settings updated successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save scorecard settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-semibold text-[var(--jb-charcoal)] mb-1">
            Scorecard Settings
          </h2>

          <p className="text-sm text-slate-500">
            Add, edit, reorder, activate, or deactivate scoring criteria.
            Deactivated criteria remain available for historical results.
          </p>
        </div>

        <button
          type="button"
          onClick={addCriterion}
          className="border border-[var(--jb-navy)] text-[var(--jb-navy)] px-4 py-2 rounded text-sm font-semibold hover:bg-slate-50"
        >
          Add Criterion
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">
          Loading scorecard settings...
        </p>
      )}

      {!loading && (
        <>
          {criteria.map((criterion, index) => (
            <div
              key={criterion.clientKey}
              className="border border-slate-200 rounded-lg p-4 mb-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-700">
                    Criterion {index + 1}
                  </h3>

                  {!criterion.id && (
                    <p className="text-xs text-slate-400 mt-1">
                      New criterion
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => moveCriterion(index, -1)}
                    disabled={index === 0}
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 disabled:opacity-40"
                  >
                    Move Up
                  </button>

                  <button
                    type="button"
                    onClick={() => moveCriterion(index, 1)}
                    disabled={index === criteria.length - 1}
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 disabled:opacity-40"
                  >
                    Move Down
                  </button>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={criterion.isActive}
                      onChange={(event) =>
                        updateCriterion(
                          criterion.clientKey,
                          "isActive",
                          event.target.checked
                        )
                      }
                    />
                    Active
                  </label>
                </div>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Name
              </label>

              <input
                className="w-full border rounded px-3 py-2 mb-4 text-sm"
                value={criterion.name}
                maxLength={100}
                onChange={(event) =>
                  updateCriterion(
                    criterion.clientKey,
                    "name",
                    event.target.value
                  )
                }
              />

              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Description
              </label>

              <textarea
                rows={3}
                className="w-full border rounded px-3 py-2 mb-4 text-sm"
                value={criterion.description}
                maxLength={500}
                onChange={(event) =>
                  updateCriterion(
                    criterion.clientKey,
                    "description",
                    event.target.value
                  )
                }
              />

              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Max Score
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    className="border rounded px-3 py-2 w-24"
                    value={criterion.maxScore}
                    onChange={(event) =>
                      updateCriterion(
                        criterion.clientKey,
                        "maxScore",
                        Number(event.target.value)
                      )
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Weight
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    className="border rounded px-3 py-2 w-24"
                    value={criterion.weight}
                    onChange={(event) =>
                      updateCriterion(
                        criterion.clientKey,
                        "weight",
                        Number(event.target.value)
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {error && (
            <p className="bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg px-4 py-3 mb-4">
              {error}
            </p>
          )}

          {success && (
            <p className="bg-green-50 border border-green-200 text-sm text-green-700 rounded-lg px-4 py-3 mb-4">
              {success}
            </p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-[var(--jb-navy)] text-white px-6 py-2 rounded text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Scorecard Settings"}
          </button>
        </>
      )}
    </section>
  );
}