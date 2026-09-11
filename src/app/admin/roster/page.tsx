"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import { createUser, getUsers, updateUser, updateWeeklyCallGoal, type User } from "@/lib/api";

const USER_ROLES: User["role"][] = ["ADVISOR", "MANAGER", "ADMIN"];

type NewUserForm = {
  name: string;
  email: string;
  role: User["role"];
  weeklyCallGoal: number;
};

const initialNewUserForm: NewUserForm = {
  name: "",
  email: "",
  role: "ADVISOR",
  weeklyCallGoal: 3,
};

function normalizeWeeklyGoal(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(50, Math.round(value)));
}

export default function AdminRosterPage() {
  const router = useRouter();
  const { data: authSession, status } = useSession();
  const isAdmin = authSession?.user?.role === "ADMIN";

  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<NewUserForm>(initialNewUserForm);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/");
      return;
    }

    const role = authSession?.user?.role;

    if (role !== "MANAGER" && role !== "ADMIN") {
      router.replace("/auth/forbidden");
      return;
    }

    getUsers({ includeInactive: true })
      .then((data) => setUsers(data))
      .catch(() => setError("Could not load roster."))
      .finally(() => setLoading(false));
  }, [authSession?.user?.role, router, status]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
  }, [users]);

  function updateLocalUser(userId: string, updates: Partial<User>) {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      )
    );
  }

  async function saveUser(userId: string, updates?: Partial<User>) {
    const currentUser = users.find((user) => user.id === userId);

    if (!currentUser) return;

    const payload = {
      name: updates?.name ?? currentUser.name,
      email: updates?.email ?? currentUser.email,
      role: updates?.role ?? currentUser.role,
      weeklyCallGoal: normalizeWeeklyGoal(
        updates?.weeklyCallGoal ?? currentUser.weeklyCallGoal
      ),
      isActive: updates?.isActive ?? currentUser.isActive,
    };

    if (!payload.name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!payload.email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setSavingUserId(userId);

      const saved = await updateUser(userId, payload);

      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === saved.id ? saved : user))
      );
      setSuccessMessage("Roster updated.");
    } catch {
      setError("Could not update user.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function saveWeeklyGoal(userId: string, weeklyCallGoal: number) {
    const normalizedGoal = normalizeWeeklyGoal(weeklyCallGoal);

    try {
      setError("");
      setSuccessMessage("");
      setSavingUserId(userId);

      const saved = await updateWeeklyCallGoal(
        userId,
        normalizedGoal
      );

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === saved.id ? saved : user
        )
      );

      setSuccessMessage("Weekly goal updated.");
    } catch {
      setError("Could not update weekly call goal.");
    } finally {
      setSavingUserId(null);
    }
  }
  async function handleAddUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      role: newUser.role,
      weeklyCallGoal: normalizeWeeklyGoal(newUser.weeklyCallGoal),
    };

    if (!payload.name) {
      setError("Name is required.");
      return;
    }

    if (!payload.email) {
      setError("Email is required.");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setAddingUser(true);

      const created = await createUser(payload);

      setUsers((currentUsers) => [...currentUsers, created]);
      setNewUser(initialNewUserForm);
      setSuccessMessage("User added.");
        } catch (error) {
      setError(error instanceof Error ? error.message : "Could not add user.");
    } finally {
      setAddingUser(false);
    }
  }

  function handleRoleChange(user: User, role: User["role"]) {
    updateLocalUser(user.id, { role });
    void saveUser(user.id, { role });
  }

  function handleActiveToggle(user: User) {
    const isActive = !user.isActive;
    updateLocalUser(user.id, { isActive });
    void saveUser(user.id, { isActive });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            {isAdmin ? "Admin" : "Manager"}
          </p>
          <h1 className="text-2xl font-bold text-[var(--jb-charcoal)]">
            Roster Management
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {isAdmin
              ? "Add users, update roles, set weekly call goals, and manage account access."
              : "View the team roster and set weekly call goals for advisors."}
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

        {isAdmin && (
        <section className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="font-semibold text-[var(--jb-charcoal)] mb-4">Add User</h2>

          <form onSubmit={handleAddUser} className="grid gap-4 md:grid-cols-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Name
              </label>
              <input
                value={newUser.name}
                onChange={(event) =>
                  setNewUser((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Advisor name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Email
              </label>
              <input
                type="email"
                value={newUser.email}
                onChange={(event) =>
                  setNewUser((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Role
              </label>
              <select
                value={newUser.role}
                onChange={(event) =>
                  setNewUser((current) => ({
                    ...current,
                    role: event.target.value as User["role"],
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Weekly Goal
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={newUser.weeklyCallGoal}
                onChange={(event) =>
                  setNewUser((current) => ({
                    ...current,
                    weeklyCallGoal: normalizeWeeklyGoal(Number(event.target.value)),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={addingUser}
                className="w-full rounded-md bg-[var(--jb-navy)] text-white px-4 py-2 text-sm font-semibold hover:bg-[var(--jb-blue)] disabled:opacity-60"
              >
                {addingUser ? "Adding..." : "Add User"}
              </button>
            </div>
          </form>
        </section>
        )}

        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-[var(--jb-charcoal)]">Current Roster</h2>
            <p className="text-sm text-slate-500 mt-1">
              Deactivated users remain in historical reports but will not appear
              in the normal user picker.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 px-5 py-4">Loading...</p>
          ) : sortedUsers.length === 0 ? (
            <p className="text-sm text-slate-500 px-5 py-4">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {["Status", "Name", "Email", "Role", "Weekly Goal", "Action"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sortedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className={user.isActive ? "hover:bg-slate-50" : "bg-slate-50"}
                    >
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            user.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <input
                          value={user.name}
                          disabled={!isAdmin}
                          onChange={(event) =>
                            updateLocalUser(user.id, { name: event.target.value })
                          }
                          onBlur={() => void saveUser(user.id)}
                          className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </td>

                      <td className="px-4 py-4 align-top">
                        <input
                          type="email"
                          value={user.email}
                          disabled={!isAdmin}
                          onChange={(event) =>
                            updateLocalUser(user.id, { email: event.target.value })
                          }
                          onBlur={() => void saveUser(user.id)}
                          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </td>

                      <td className="px-4 py-4 align-top">
                        <select
                          value={user.role}
                          disabled={!isAdmin}
                          onChange={(event) =>
                            handleRoleChange(user, event.target.value as User["role"])
                          }
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        >
                          {USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={user.weeklyCallGoal}
                          onChange={(event) =>
                            updateLocalUser(user.id, {
                              weeklyCallGoal: normalizeWeeklyGoal(
                                Number(event.target.value)
                              ),
                            })
                          }
                          onBlur={() =>
                            void saveWeeklyGoal(user.id, user.weeklyCallGoal)
                          }
                          disabled={!isAdmin && user.role !== "ADVISOR"}
                          className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleActiveToggle(user)}
                            className="text-sm font-medium text-[var(--jb-navy)] hover:underline"
                          >
                            {user.isActive ? "Deactivate" : "Reactivate"}
                          </button>

                          {savingUserId === user.id && (
                            <span className="text-xs text-slate-400">Saving...</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
