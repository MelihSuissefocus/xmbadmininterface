"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createUser,
  updateUser,
  changePassword,
  resetPassword,
  toggleUserActive,
  unlockUser,
  deleteUser,
} from "@/actions/users";
import {
  Plus,
  Search,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Trash2,
  Edit,
  X,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface UsersListProps {
  users: User[];
  currentUserId?: string;
}

const roleLabels = {
  admin: "Administrator",
  recruiter: "Recruiter",
  viewer: "Betrachter",
};

const roleColors = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  recruiter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

export function UsersList({ users, currentUserId }: UsersListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "recruiter" as "admin" | "recruiter" | "viewer",
  });

  const [newPassword, setNewPassword] = useState("");

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      showMessage("error", "Bitte alle Felder ausfüllen");
      return;
    }

    setLoading(true);
    const result = await createUser(newUser);
    setLoading(false);

    if (result.success) {
      showMessage("success", result.message);
      setShowCreateModal(false);
      setNewUser({ name: "", email: "", password: "", role: "recruiter" });
      router.refresh();
    } else {
      showMessage("error", result.message);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setLoading(true);
    const result = await updateUser(editingUser.id, {
      name: editingUser.name ?? undefined,
      email: editingUser.email,
      role: editingUser.role ?? "admin",
    });
    setLoading(false);

    if (result.success) {
      showMessage("success", result.message);
      setEditingUser(null);
      router.refresh();
    } else {
      showMessage("error", result.message);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordUser || !newPassword) return;

    setLoading(true);
    const result = await changePassword(passwordUser.id, newPassword);
    setLoading(false);

    if (result.success) {
      showMessage("success", result.message);
      setPasswordUser(null);
      setNewPassword("");
    } else {
      showMessage("error", result.message);
    }
  };

  const handleResetPassword = async (user: User) => {
    if (!confirm(`Passwort von "${user.name || user.email}" wirklich zurücksetzen?`)) return;

    setLoading(true);
    const result = await resetPassword(user.id);
    setLoading(false);

    if (result.success) {
      alert(result.message);
      router.refresh();
    } else {
      showMessage("error", result.message);
    }
  };

  const handleToggleActive = async (user: User) => {
    const action = user.isActive === 1 ? "deaktivieren" : "aktivieren";
    if (!confirm(`"${user.name || user.email}" wirklich ${action}?`)) return;

    setLoading(true);
    const result = await toggleUserActive(user.id);
    setLoading(false);

    if (result.success) {
      showMessage("success", result.message);
      router.refresh();
    } else {
      showMessage("error", result.message);
    }
  };

  const handleUnlock = async (user: User) => {
    setLoading(true);
    const result = await unlockUser(user.id);
    setLoading(false);

    if (result.success) {
      showMessage("success", result.message);
      router.refresh();
    } else {
      showMessage("error", result.message);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`"${user.name || user.email}" wirklich LÖSCHEN? Diese Aktion kann nicht rückgängig gemacht werden!`))
      return;

    setLoading(true);
    const result = await deleteUser(user.id);
    setLoading(false);

    if (result.success) {
      showMessage("success", result.message);
      router.refresh();
    } else {
      showMessage("error", result.message);
    }
  };

  const isLocked = (user: User) => user.lockedUntil && new Date(user.lockedUntil) > new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Benutzerverwaltung
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {users.length} Benutzer im System
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-amber-500 hover:bg-amber-400 text-black"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Neuer Benutzer
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Name oder E-Mail..."
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">
                Benutzer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">
                Rolle
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">
                Erstellt
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredUsers.map((user) => {
              const locked = isLocked(user);
              const isCurrentUser = user.id === currentUserId;

              return (
                <tr
                  key={user.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    isCurrentUser ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                          user.isActive === 1
                            ? "bg-slate-900 text-amber-400"
                            : "bg-slate-300 text-slate-500"
                        }`}
                      >
                        {(user.name || user.email)
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {user.name || "—"}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">(Du)</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        roleColors[user.role ?? "admin"]
                      }`}
                    >
                      {roleLabels[user.role ?? "admin"]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      {user.isActive === 0 ? (
                        <span className="flex items-center gap-1 text-sm text-red-600">
                          <XCircle className="h-4 w-4" />
                          Deaktiviert
                        </span>
                      ) : locked ? (
                        <span className="flex items-center gap-1 text-sm text-amber-600">
                          <Lock className="h-4 w-4" />
                          Gesperrt
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          Aktiv
                        </span>
                      )}
                      {user.failedAttempts && user.failedAttempts > 0 && (
                        <span className="text-xs text-slate-500">
                          {user.failedAttempts} Fehlversuche
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("de-CH")
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {locked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlock(user)}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Unlock className="h-4 w-4" />
                          <span className="text-xs">Entsperren</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                        className="hover:bg-slate-100"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="text-xs">Bearbeiten</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPasswordUser(user)}
                        className="hover:bg-slate-100"
                      >
                        <Key className="h-4 w-4" />
                        <span className="text-xs">Passwort</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPassword(user)}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        <span className="text-xs">Reset</span>
                      </Button>
                      {!isCurrentUser && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user)}
                            className={
                              user.isActive === 1
                                ? "text-slate-600 hover:text-red-600 hover:bg-red-50"
                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            }
                          >
                            {user.isActive === 1 ? (
                              <>
                                <ShieldAlert className="h-4 w-4" />
                                <span className="text-xs">Deaktivieren</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4" />
                                <span className="text-xs">Aktivieren</span>
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="text-xs">Löschen</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Neuer Benutzer
              </h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreateModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newName">Name</Label>
                <Input
                  id="newName"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="newEmail">E-Mail</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">Passwort</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="newRole">Rolle</Label>
                <select
                  id="newRole"
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value as "admin" | "recruiter" | "viewer" })
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="admin">Administrator</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="viewer">Betrachter</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCreateUser}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black"
                >
                  Erstellen
                </Button>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Benutzer bearbeiten
              </h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setEditingUser(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  value={editingUser.name ?? ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="editEmail">E-Mail</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="editRole">Rolle</Label>
                <select
                  id="editRole"
                  value={editingUser.role ?? "admin"}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      role: e.target.value as "admin" | "recruiter" | "viewer",
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="admin">Administrator</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="viewer">Betrachter</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleUpdateUser}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black"
                >
                  Speichern
                </Button>
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Passwort ändern
              </h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setPasswordUser(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Neues Passwort für <strong>{passwordUser.name || passwordUser.email}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="changePassword">Neues Passwort</Label>
                <Input
                  id="changePassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="mt-1.5"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={loading || newPassword.length < 6}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black"
                >
                  Passwort ändern
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasswordUser(null);
                    setNewPassword("");
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

