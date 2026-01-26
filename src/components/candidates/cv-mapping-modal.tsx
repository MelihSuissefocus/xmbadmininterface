"use client";

import { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Eye,
  Edit2,
  Check,
  XCircle,
  Bookmark,
  Info,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type {
  CandidateAutoFillDraftV2,
  ExtractedFieldWithEvidence,
} from "@/lib/azure-di/types";
import type { CandidateFormData } from "@/lib/cv-autofill/types";
import { addFieldSynonym, recordExtractionFeedback, recordFieldReassignment } from "@/actions/extraction-config";

export interface CVMappingModalProps {
  draft: CandidateAutoFillDraftV2 | null;
  jobId?: string;
  onConfirm: (mappedData: Partial<CandidateFormData>) => void;
  onCancel: () => void;
  isOpen: boolean;
}

type FieldAction = "confirm" | "edit" | "reject" | "reassign";

interface FieldState {
  action: FieldAction;
  editedValue: string;
  rememberMapping: boolean;
  reassignedTo: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Vorname",
  lastName: "Nachname",
  email: "E-Mail",
  phone: "Telefon",
  street: "Strasse",
  postalCode: "PLZ",
  city: "Ort",
  canton: "Kanton",
  linkedinUrl: "LinkedIn",
  targetRole: "Zielposition",
  birthdate: "Geburtsdatum",
  languages: "Sprachen",
  skills: "Skills",
  experience: "Berufserfahrung",
  education: "Ausbildung",
  certificates: "Zertifikate",
  yearsOfExperience: "Berufserfahrung (Jahre)",
  currentSalary: "Aktuelles Gehalt",
  expectedSalary: "Gewünschtes Gehalt",
  desiredHourlyRate: "Gewünschter Stundensatz",
  noticePeriod: "Kündigungsfrist",
  availableFrom: "Verfügbar ab",
  notes: "Notizen",
  nationality: "Nationalität",
  workloadPreference: "Arbeitspensum",
  companyName: "Firmenname",
};

// Alle verfügbaren Felder für die Neuzuweisung
const ALL_AVAILABLE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "postalCode",
  "city",
  "canton",
  "linkedinUrl",
  "targetRole",
  "birthdate",
  "yearsOfExperience",
  "currentSalary",
  "expectedSalary",
  "desiredHourlyRate",
  "noticePeriod",
  "availableFrom",
  "notes",
  "nationality",
  "workloadPreference",
  "companyName",
];

export function CVMappingModal({
  draft,
  jobId,
  onConfirm,
  onCancel,
  isOpen,
}: CVMappingModalProps) {
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [ambiguousSelections, setAmbiguousSelections] = useState<Record<number, string | null>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());

  if (!draft) return null;

  const { filledFields, ambiguousFields, metadata, extractionVersion, provider } = draft;

  const getFieldState = (field: ExtractedFieldWithEvidence): FieldState => {
    return fieldStates[field.targetField] || {
      action: "confirm",
      editedValue: typeof field.extractedValue === "string" ? field.extractedValue : JSON.stringify(field.extractedValue),
      rememberMapping: false,
      reassignedTo: null,
    };
  };

  const updateFieldState = (targetField: string, updates: Partial<FieldState>) => {
    setFieldStates((prev) => ({
      ...prev,
      [targetField]: { ...getFieldState({ targetField } as ExtractedFieldWithEvidence), ...prev[targetField], ...updates },
    }));
  };

  const toggleEvidence = (key: string) => {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    const mappedData: Partial<CandidateFormData> = {};

    for (const field of filledFields) {
      const state = getFieldState(field);

      if (state.action === "reject") {
        if (jobId) {
          recordExtractionFeedback(
            jobId,
            field.targetField,
            typeof field.extractedValue === "string" ? field.extractedValue : JSON.stringify(field.extractedValue),
            null,
            "reject",
            field.evidence.confidence
          );
        }
        continue;
      }

      // Neuzuweisung: Der Wert wird einem anderen Feld zugewiesen
      if (state.action === "reassign" && state.reassignedTo) {
        const finalValue = typeof field.extractedValue === "string" 
          ? field.extractedValue 
          : JSON.stringify(field.extractedValue);
        
        // Speichere den Wert im neuen Zielfeld
        setNestedValue(mappedData, state.reassignedTo, finalValue);
        
        if (jobId) {
          // Speichere das Reassignment-Feedback für maschinelles Lernen
          recordFieldReassignment(
            jobId,
            field.targetField,
            state.reassignedTo,
            finalValue,
            field.targetField, // Verwende das ursprüngliche targetField als Label
            field.evidence.confidence,
            state.rememberMapping
          );
        }
        continue;
      }

      let finalValue: unknown;
      if (state.action === "edit") {
        finalValue = state.editedValue;
        if (jobId) {
          recordExtractionFeedback(
            jobId,
            field.targetField,
            typeof field.extractedValue === "string" ? field.extractedValue : JSON.stringify(field.extractedValue),
            state.editedValue,
            "edit",
            field.evidence.confidence
          );
        }
      } else {
        finalValue = field.extractedValue;
        if (jobId) {
          recordExtractionFeedback(
            jobId,
            field.targetField,
            typeof field.extractedValue === "string" ? field.extractedValue : JSON.stringify(field.extractedValue),
            null,
            "confirm",
            field.evidence.confidence
          );
        }
      }

      setNestedValue(mappedData, field.targetField, finalValue);
    }

    ambiguousFields.forEach((field, index) => {
      const selectedTarget = ambiguousSelections[index];
      if (selectedTarget && selectedTarget !== "ignore") {
        setNestedValue(mappedData, selectedTarget, field.extractedValue);

        const state = fieldStates[`ambiguous_${index}`];
        if (state?.rememberMapping) {
          addFieldSynonym(field.extractedLabel, selectedTarget);
        }
      }
    });

    onConfirm(mappedData);
  };

  const handleClose = () => {
    setFieldStates({});
    setAmbiguousSelections({});
    setExpandedEvidence(new Set());
    onCancel();
  };

  const confirmedCount = filledFields.filter((f) => getFieldState(f).action === "confirm").length;
  const editedCount = filledFields.filter((f) => getFieldState(f).action === "edit").length;
  const rejectedCount = filledFields.filter((f) => getFieldState(f).action === "reject").length;
  const reassignedCount = filledFields.filter((f) => getFieldState(f).action === "reassign").length;

  // Berechne welche Felder bereits belegt sind (für die Auswahl bei Neuzuweisung)
  const usedFields = new Set<string>();
  filledFields.forEach((f) => {
    const state = getFieldState(f);
    if (state.action === "confirm" || state.action === "edit") {
      usedFields.add(f.targetField);
    } else if (state.action === "reassign" && state.reassignedTo) {
      usedFields.add(state.reassignedTo);
    }
  });
  
  // Verfügbare Felder für Neuzuweisung (alle Felder außer die bereits belegten)
  const getAvailableFieldsForReassign = (currentField: string): string[] => {
    return ALL_AVAILABLE_FIELDS.filter(
      (f) => f !== currentField && !usedFields.has(f)
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CV-Daten Überprüfen
          </DialogTitle>
          <DialogDescription>
            Überprüfen, bearbeiten oder ablehnen Sie die extrahierten Felder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 text-sm text-muted-foreground flex-wrap items-center">
          <span>{metadata.fileName}</span>
          <span>•</span>
          <span>{(metadata.fileSize / 1024).toFixed(0)} KB</span>
          <span>•</span>
          <span>{metadata.pageCount} Seiten</span>
          <span>•</span>
          <span>{(metadata.processingTimeMs / 1000).toFixed(1)}s</span>
          <span>•</span>
          <Badge variant="outline" className="text-xs">
            {provider} v{extractionVersion}
          </Badge>
          {extractionVersion.includes("llm") && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              KI-unterstützt
            </Badge>
          )}
        </div>

        <div className="flex gap-4 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            {confirmedCount} bestätigt
          </span>
          <span className="flex items-center gap-1">
            <Edit2 className="h-3 w-3 text-blue-600" />
            {editedCount} bearbeitet
          </span>
          <span className="flex items-center gap-1">
            <ArrowRightLeft className="h-3 w-3 text-purple-600" />
            {reassignedCount} neu zugewiesen
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-600" />
            {rejectedCount} abgelehnt
          </span>
        </div>

        <ScrollArea className="h-[50vh]">
          {filledFields.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Extrahierte Felder ({filledFields.length})
              </h3>
              <div className="space-y-2">
                {filledFields.map((field, index) => (
                  <ExtractedFieldRow
                    key={`${field.targetField}-${index}`}
                    field={field}
                    state={getFieldState(field)}
                    isEvidenceExpanded={expandedEvidence.has(field.targetField)}
                    onToggleEvidence={() => toggleEvidence(field.targetField)}
                    onUpdateState={(updates) => updateFieldState(field.targetField, updates)}
                    availableFieldsForReassign={getAvailableFieldsForReassign(field.targetField)}
                  />
                ))}
              </div>
            </div>
          )}

          {filledFields.length > 0 && ambiguousFields.length > 0 && (
            <Separator className="my-4" />
          )}

          {ambiguousFields.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Zur Überprüfung ({ambiguousFields.length})
              </h3>
              <div className="space-y-3">
                {ambiguousFields.map((field, index) => (
                  <div
                    key={index}
                    className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900"
                  >
                    <div className="mb-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{field.extractedLabel}</div>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(field.evidence.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{field.extractedValue}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>Seite {field.evidence.page}</span>
                        <span className="font-mono bg-white/50 dark:bg-black/20 px-1 rounded">
                          &quot;{field.evidence.exactText.substring(0, 40)}...&quot;
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center mt-2">
                      <select
                        className="flex-1 p-2 border rounded text-sm"
                        value={ambiguousSelections[index] || field.suggestedTargets[0]?.targetField || ""}
                        onChange={(e) => setAmbiguousSelections((prev) => ({ ...prev, [index]: e.target.value }))}
                      >
                        {field.suggestedTargets.map((target, idx) => (
                          <option key={idx} value={target.targetField}>
                            {FIELD_LABELS[target.targetField] || target.targetField} ({target.confidence})
                          </option>
                        ))}
                        <option value="ignore">Ignorieren</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldStates[`ambiguous_${index}`]?.rememberMapping || false}
                          onChange={(e) =>
                            updateFieldState(`ambiguous_${index}`, { rememberMapping: e.target.checked })
                          }
                          className="h-3 w-3"
                        />
                        <Bookmark className="h-3 w-3" />
                        Merken
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filledFields.length === 0 && ambiguousFields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Keine Daten gefunden. Bitte versuchen Sie es mit einem anderen CV.
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={confirmedCount + editedCount + reassignedCount === 0}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {confirmedCount + editedCount + reassignedCount} Felder übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtractedFieldRow({
  field,
  state,
  isEvidenceExpanded,
  onToggleEvidence,
  onUpdateState,
  availableFieldsForReassign,
}: {
  field: ExtractedFieldWithEvidence;
  state: FieldState;
  isEvidenceExpanded: boolean;
  onToggleEvidence: () => void;
  onUpdateState: (updates: Partial<FieldState>) => void;
  availableFieldsForReassign: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [editValue, setEditValue] = useState(
    typeof field.extractedValue === "string" ? field.extractedValue : JSON.stringify(field.extractedValue)
  );

  const displayValue = typeof field.extractedValue === "string"
    ? field.extractedValue
    : Array.isArray(field.extractedValue)
    ? `${field.extractedValue.length} Einträge`
    : JSON.stringify(field.extractedValue);

  const bgColor = state.action === "reject"
    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
    : state.action === "edit"
    ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
    : state.action === "reassign"
    ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900"
    : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900";

  const handleSaveEdit = () => {
    onUpdateState({ action: "edit", editedValue: editValue });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(typeof field.extractedValue === "string" ? field.extractedValue : JSON.stringify(field.extractedValue));
    setIsEditing(false);
  };

  return (
    <div className={`p-3 rounded-lg border ${bgColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {FIELD_LABELS[field.targetField] || field.targetField}
            </span>
            <Badge
              variant={
                field.confidence === "high"
                  ? "default"
                  : field.confidence === "medium"
                  ? "secondary"
                  : "outline"
              }
              className="text-xs"
            >
              {Math.round(field.evidence.confidence * 100)}%
            </Badge>
          </div>

          {isEditing ? (
            <div className="flex gap-2 mt-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-sm h-8"
              />
              <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-8 px-2">
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 px-2">
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ) : isReassigning ? (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <ArrowRightLeft className="h-3 w-3" />
                <span>Diesen Wert einem anderen Feld zuweisen:</span>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 p-2 border rounded text-sm"
                  value={state.reassignedTo || ""}
                  onChange={(e) => onUpdateState({ reassignedTo: e.target.value || null })}
                >
                  <option value="">-- Feld wählen --</option>
                  {availableFieldsForReassign.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f] || f}
                    </option>
                  ))}
                </select>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    if (state.reassignedTo) {
                      onUpdateState({ action: "reassign" });
                    }
                    setIsReassigning(false);
                  }} 
                  className="h-8 px-2"
                  disabled={!state.reassignedTo}
                >
                  <Check className="h-4 w-4 text-purple-600" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    onUpdateState({ reassignedTo: null, action: "confirm" });
                    setIsReassigning(false);
                  }} 
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.rememberMapping || false}
                  onChange={(e) => onUpdateState({ rememberMapping: e.target.checked })}
                  className="h-3 w-3"
                />
                <Bookmark className="h-3 w-3" />
                Diese Zuordnung für zukünftige CVs merken
              </label>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-1 truncate">
              {state.action === "edit" ? (
                <span className="text-blue-600">{state.editedValue}</span>
              ) : state.action === "reject" ? (
                <span className="line-through text-red-600">{displayValue}</span>
              ) : state.action === "reassign" && state.reassignedTo ? (
                <span className="text-purple-600 flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3" />
                  {displayValue} → {FIELD_LABELS[state.reassignedTo] || state.reassignedTo}
                </span>
              ) : (
                displayValue
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isEditing && !isReassigning && typeof field.extractedValue === "string" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 w-7 p-0"
              title="Bearbeiten"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          {!isEditing && !isReassigning && availableFieldsForReassign.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsReassigning(true)}
              className="h-7 w-7 p-0"
              title="Anderem Feld zuweisen"
            >
              <ArrowRightLeft className="h-3 w-3 text-purple-600" />
            </Button>
          )}
          {!isEditing && !isReassigning && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateState({ 
                action: state.action === "confirm" || state.action === "reassign" ? "reject" : "confirm",
                reassignedTo: null 
              })}
              className="h-7 w-7 p-0"
              title={state.action === "reject" ? "Wiederherstellen" : "Ablehnen"}
            >
              {state.action === "reject" ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleEvidence}
            className="h-7 w-7 p-0"
            title="Nachweis anzeigen"
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isEvidenceExpanded && field.evidence && (
        <div className="mt-2 pt-2 border-t border-current/10 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-1">
            <Info className="h-3 w-3" />
            <span className="font-medium">Warum wurde dieser Wert extrahiert?</span>
          </div>
          <div className="flex gap-4">
            <span>📄 Seite {field.evidence.page}</span>
            <span>📊 Konfidenz: {(field.evidence.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-1 p-2 bg-white/50 dark:bg-black/20 rounded text-xs font-mono break-all">
            <span className="text-muted-foreground">Gefunden im Text: </span>
            &quot;{field.evidence.exactText}&quot;
          </div>
        </div>
      )}
    </div>
  );
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
  const arrayMatch = path.match(/^(\w+)\[(\d+)\]\.(\w+)$/);
  if (arrayMatch) {
    const [, arrayName, indexStr, fieldName] = arrayMatch;
    const index = parseInt(indexStr);

    if (!Array.isArray(obj[arrayName])) {
      obj[arrayName] = [];
    }
    const arr = obj[arrayName] as Record<string, unknown>[];

    while (arr.length <= index) {
      arr.push({});
    }

    arr[index][fieldName] = value;
    return;
  }

  if (!path.includes(".") && !path.includes("[")) {
    obj[path] = value;
    return;
  }

  obj[path] = value;
}
