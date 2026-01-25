"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmailTemplate } from "@/db/schema";
import { createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, toggleEmailTemplateActive } from "@/actions/email-templates";
import { Mail, Plus, Trash2, Edit, CheckCircle, XCircle } from "lucide-react";

interface EmailTemplatesPanelProps {
  initialTemplates: EmailTemplate[];
}

export function EmailTemplatesPanel({ initialTemplates }: EmailTemplatesPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    description: "",
  });

  const handleCreate = async () => {
    setLoading(true);
    const result = await createEmailTemplate(formData);
    setLoading(false);

    if (result.success) {
      setOpen(false);
      setFormData({ name: "", subject: "", body: "", description: "" });
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      description: template.description || "",
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    const result = await updateEmailTemplate(selectedTemplate.id, formData);
    setLoading(false);

    if (result.success) {
      setEditOpen(false);
      setSelectedTemplate(null);
      setFormData({ name: "", subject: "", body: "", description: "" });
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Vorlage "${name}" wirklich löschen?`)) return;
    
    const result = await deleteEmailTemplate(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleToggleActive = async (id: string) => {
    const result = await toggleEmailTemplateActive(id);
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              E-Mail-Vorlagen
            </h2>
            <p className="text-sm text-slate-500">{initialTemplates.length} Vorlagen</p>
          </div>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-500 hover:bg-indigo-400 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Neue Vorlage
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Neue E-Mail-Vorlage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. welcome_email"
                />
              </div>
              <div>
                <Label htmlFor="subject">Betreff</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Willkommen bei XMB"
                />
              </div>
              <div>
                <Label htmlFor="body">Nachricht</Label>
                <Textarea
                  id="body"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="E-Mail-Inhalt..."
                  className="min-h-[200px]"
                />
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Input
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
              <Button onClick={handleCreate} disabled={loading || !formData.name || !formData.subject || !formData.body}>
                Erstellen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vorlage bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-subject">Betreff</Label>
                <Input
                  id="edit-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-body">Nachricht</Label>
                <Textarea
                  id="edit-body"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="min-h-[200px]"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleUpdate} disabled={loading || !formData.name || !formData.subject || !formData.body}>
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {initialTemplates.map((template) => (
          <div key={template.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {template.name}
                  </h3>
                  {template.isActive === 1 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                  {template.subject}
                </p>
                {template.description && (
                  <p className="text-xs text-slate-500 mb-2">{template.description}</p>
                )}
                <p className="text-xs text-slate-400 line-clamp-2">{template.body}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleActive(template.id)}
                >
                  {template.isActive === 1 ? "Deaktivieren" : "Aktivieren"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(template.id, template.name)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {initialTemplates.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            Noch keine E-Mail-Vorlagen erstellt
          </div>
        )}
      </div>
    </section>
  );
}

