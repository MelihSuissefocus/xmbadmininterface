"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skill } from "@/db/schema";
import { createSkill, deleteSkill } from "@/actions/skills";
import { Plus, X, Award } from "lucide-react";

interface SkillsManagementProps {
  initialSkills: Skill[];
}

export function SkillsManagement({ initialSkills }: SkillsManagementProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [skills, setSkills] = useState(initialSkills);
  const [newSkillName, setNewSkillName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newSkillName.trim()) return;
    
    setLoading(true);
    const result = await createSkill({ name: newSkillName.trim() });
    setLoading(false);

    if (result.success) {
      setNewSkillName("");
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Skill "${name}" wirklich löschen?`)) return;
    
    const result = await deleteSkill(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500">
          <Award className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Skills-Verwaltung
          </h2>
          <p className="text-sm text-slate-500">{skills.length} Skills erfasst</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <Label htmlFor="newSkill" className="sr-only">
            Neuer Skill
          </Label>
          <Input
            id="newSkill"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="Skill-Name eingeben..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={loading}
          />
        </div>
        <Button
          onClick={handleAdd}
          disabled={!newSkillName.trim() || loading}
          className="bg-amber-500 hover:bg-amber-400 text-black"
        >
          <Plus className="h-4 w-4 mr-1" />
          Hinzufügen
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
            >
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {skill.name}
              </span>
              <button
                onClick={() => handleDelete(skill.id, skill.name)}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Löschen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {skills.length === 0 && (
          <p className="text-center text-slate-500 py-8">
            Noch keine Skills erfasst
          </p>
        )}
      </div>
    </section>
  );
}

