"use client";

import { useState } from "react";
import { X, CheckCircle2, AlertCircle, HelpCircle, FileText, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type {
  CandidateAutoFillDraftV2,
  ExtractedFieldWithEvidence,
} from "@/lib/azure-di/types";
import type { CandidateFormData } from "@/lib/cv-autofill/types";

export interface CVMappingModalProps {
  draft: CandidateAutoFillDraftV2 | null;
  onConfirm: (mappedData: Partial<CandidateFormData>) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function CVMappingModal({
  draft,
  onConfirm,
  onCancel,
  isOpen,
}: CVMappingModalProps) {
  const [ambiguousSelections, setAmbiguousSelections] = useState<Record<number, string | null>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set());

  if (!draft) return null;

  const { filledFields, ambiguousFields, unmappedItems, metadata, extractionVersion, provider } = draft;

  const handleAmbiguousChange = (index: number, value: string | null) => {
    setAmbiguousSelections(prev => ({ ...prev, [index]: value }));
  };

  const toggleEvidence = (index: number) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const mappedData: Partial<CandidateFormData> = {};

    for (const field of filledFields) {
      setNestedValue(mappedData, field.targetField, field.extractedValue);
    }

    ambiguousFields.forEach((field, index) => {
      const selectedTarget = ambiguousSelections[index];
      if (selectedTarget && selectedTarget !== "ignore") {
        setNestedValue(mappedData, selectedTarget, field.extractedValue);
      }
    });

    onConfirm(mappedData);
  };

  const handleClose = () => {
    setAmbiguousSelections({});
    setExpandedEvidence(new Set());
    onCancel();
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
            Überprüfen Sie die extrahierten Daten und bestätigen Sie die Zuordnung zu den Formularfeldern.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 text-sm text-muted-foreground flex-wrap">
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
        </div>

        <ScrollArea className="h-[50vh]">
          {filledFields.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Erfolgreich zugeordnet ({filledFields.length})
              </h3>
              <div className="space-y-2">
                {filledFields.map((field, index) => (
                  <FilledFieldRow
                    key={index}
                    field={field}
                    index={index}
                    isExpanded={expandedEvidence.has(index)}
                    onToggleEvidence={() => toggleEvidence(index)}
                  />
                ))}
              </div>
            </div>
          )}

          {filledFields.length > 0 && (ambiguousFields.length > 0 || unmappedItems.length > 0) && (
            <Separator className="my-4" />
          )}

          {ambiguousFields.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Mehrdeutige Zuordnungen ({ambiguousFields.length})
              </h3>
              <div className="space-y-3">
                {ambiguousFields.map((field, index) => (
                  <div
                    key={index}
                    className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900"
                  >
                    <div className="mb-2">
                      <div className="text-sm font-medium">{field.extractedLabel}</div>
                      <div className="text-sm text-muted-foreground">{field.extractedValue}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Seite {field.evidence.page} • Konfidenz: {(field.evidence.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <select
                      className="w-full mt-2 p-2 border rounded text-sm"
                      value={ambiguousSelections[index] || field.suggestedTargets[0]?.targetField || ""}
                      onChange={(e) => handleAmbiguousChange(index, e.target.value)}
                    >
                      {field.suggestedTargets.map((target, idx) => (
                        <option key={idx} value={target.targetField}>
                          {target.targetField} ({target.confidence}) - {target.reason}
                        </option>
                      ))}
                      <option value="ignore">Ignorieren</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ambiguousFields.length > 0 && unmappedItems.length > 0 && (
            <Separator className="my-4" />
          )}

          {unmappedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-gray-600" />
                Nicht zugeordnet ({unmappedItems.length})
              </h3>
              <div className="space-y-3">
                {unmappedItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <div className="mb-2">
                      {item.extractedLabel && (
                        <div className="text-sm font-medium">{item.extractedLabel}</div>
                      )}
                      <div className="text-sm text-muted-foreground">{item.extractedValue}</div>
                      {item.category && (
                        <Badge variant="outline" className="mt-1">{item.category}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filledFields.length === 0 && ambiguousFields.length === 0 && unmappedItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Keine Daten gefunden. Bitte versuchen Sie es mit einem anderen CV.
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          <Button onClick={handleConfirm}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Daten übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilledFieldRow({
  field,
  isExpanded,
  onToggleEvidence,
}: {
  field: ExtractedFieldWithEvidence;
  index: number;
  isExpanded: boolean;
  onToggleEvidence: () => void;
}) {
  return (
    <div
      className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium">{field.targetField}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {typeof field.extractedValue === "string"
              ? field.extractedValue
              : JSON.stringify(field.extractedValue)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              field.confidence === "high"
                ? "default"
                : field.confidence === "medium"
                ? "secondary"
                : "outline"
            }
          >
            {field.confidence}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleEvidence}
            className="h-6 w-6 p-0"
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {isExpanded && field.evidence && (
        <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800 text-xs text-muted-foreground">
          <div>Seite: {field.evidence.page}</div>
          <div>Konfidenz: {(field.evidence.confidence * 100).toFixed(0)}%</div>
          <div className="mt-1 p-1 bg-white/50 dark:bg-black/20 rounded text-xs font-mono">
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

  if (!path.includes('.') && !path.includes('[')) {
    obj[path] = value;
    return;
  }

  obj[path] = value;
}
