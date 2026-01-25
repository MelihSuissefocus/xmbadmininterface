"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SystemSetting } from "@/db/schema";
import { upsertSystemSetting, deleteSystemSetting } from "@/actions/system-settings";
import { Settings, Plus, Trash2 } from "lucide-react";

interface SystemSettingsPanelProps {
  initialSettings: SystemSetting[];
}

export function SystemSettingsPanel({ initialSettings }: SystemSettingsPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    key: "",
    value: "",
    description: "",
    category: "general",
  });

  const categories = [...new Set(initialSettings.map(s => s.category))];
  const settingsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = initialSettings.filter(s => s.category === cat);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const handleCreate = async () => {
    setLoading(true);
    const result = await upsertSystemSetting(formData);
    setLoading(false);

    if (result.success) {
      setOpen(false);
      setFormData({ key: "", value: "", description: "", category: "general" });
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleDelete = async (id: string, key: string) => {
    if (!confirm(`Einstellung "${key}" wirklich löschen?`)) return;
    
    const result = await deleteSystemSetting(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleUpdate = async (setting: SystemSetting, newValue: string) => {
    const result = await upsertSystemSetting({
      key: setting.key,
      value: newValue,
      description: setting.description || undefined,
      category: setting.category,
    });
    
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Systemeinstellungen
            </h2>
            <p className="text-sm text-slate-500">{initialSettings.length} Einstellungen</p>
          </div>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-500 hover:bg-green-400 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Neue Einstellung
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Systemeinstellung</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="key">Schlüssel</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="z.B. smtp_host"
                />
              </div>
              <div>
                <Label htmlFor="value">Wert</Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="z.B. smtp.gmail.com"
                />
              </div>
              <div>
                <Label htmlFor="category">Kategorie</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Allgemein</SelectItem>
                    <SelectItem value="email">E-Mail</SelectItem>
                    <SelectItem value="security">Sicherheit</SelectItem>
                    <SelectItem value="notifications">Benachrichtigungen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optionale Beschreibung"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={loading || !formData.key || !formData.value}>
                Erstellen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {Object.entries(settingsByCategory).map(([category, settings]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 capitalize">
              {category}
            </h3>
            <div className="space-y-3">
              {settings.map((setting) => (
                <div key={setting.id} className="flex items-start gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {setting.key}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(setting.id, setting.key)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {setting.description && (
                      <p className="text-xs text-slate-500 mb-2">{setting.description}</p>
                    )}
                    <Input
                      value={setting.value}
                      onChange={(e) => handleUpdate(setting, e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

