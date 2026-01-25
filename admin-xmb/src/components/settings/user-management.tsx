"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { User } from "@/db/schema";
import { createUser, toggleUserActive, resetPassword, deleteUser } from "@/actions/users";
import { UserPlus, Lock, Trash2, Users, CheckCircle, XCircle } from "lucide-react";

interface UserManagementProps {
  initialUsers: User[];
}

export function UserManagement({ initialUsers }: UserManagementProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "recruiter" as "admin" | "recruiter" | "viewer",
  });

  const handleCreate = async () => {
    setLoading(true);
    const result = await createUser(formData);
    setLoading(false);

    if (result.success) {
      setOpen(false);
      setFormData({ name: "", email: "", password: "", role: "recruiter" });
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleToggleActive = async (id: string) => {
    const result = await toggleUserActive(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    if (!confirm(`Passwort für "${name}" zurücksetzen?`)) return;
    
    const result = await resetPassword(id);
    if (result.success) {
      alert(result.message);
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Benutzer "${name}" wirklich löschen?`)) return;
    
    const result = await deleteUser(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Benutzerverwaltung
            </h2>
            <p className="text-sm text-slate-500">{users.length} Benutzer</p>
          </div>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-400 text-white">
              <UserPlus className="h-4 w-4 mr-2" />
              Neuer Benutzer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Max Mustermann"
                />
              </div>
              <div>
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="max@beispiel.de"
                />
              </div>
              <div>
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>
              <div>
                <Label htmlFor="role">Rolle</Label>
                <Select value={formData.role} onValueChange={(value: "admin" | "recruiter" | "viewer") => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={loading || !formData.name || !formData.email || !formData.password}>
                Erstellen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Name</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">E-Mail</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Rolle</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Status</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-3 px-4 text-sm text-slate-900 dark:text-white">{user.name}</td>
                <td className="py-3 px-4 text-sm text-slate-500">{user.email}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {user.isActive === 1 ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Aktiv
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      Inaktiv
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(user.id)}
                    >
                      {user.isActive === 1 ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResetPassword(user.id, user.name || user.email)}
                    >
                      <Lock className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(user.id, user.name || user.email)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

