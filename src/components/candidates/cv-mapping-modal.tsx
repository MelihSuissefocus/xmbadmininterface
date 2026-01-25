"use client";

/**
 * CV Mapping Modal Component
 * Displays extracted CV data for review and mapping before applying to form
 */

import { useState } from "react";
import { X, CheckCircle2, AlertCircle, HelpCircle, FileText } from "lucide-react";
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
  CandidateAutoFillDraft,
  CandidateFormData,
  AmbiguousField,
  UnmappedItem,
} from "@/lib/cv-autofill/types";

export interface CVMappingModalProps {
  draft: CandidateAutoFillDraft | null;
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
  const [unmappedSelections, setUnmappedSelections] = useState<Record<number, string | null>>({});

  if (!draft) return null;

  const { filledFields, ambiguousFields, unmappedItems, metadata } = draft;

  const handleAmbiguousChange = (index: number, value: string | null) => {
    setAmbiguousSelections(prev => ({ ...prev, [index]: value }));
  };

  const handleUnmappedChange = (index: number, value: string | null) => {
    setUnmappedSelections(prev => ({ ...prev, [index]: value }));
  };

  const handleConfirm = () => {
    // Build the mapped data from filled fields, ambiguous selections, and unmapped selections
    const mappedData: Partial<CandidateFormData> = {};

    // Add filled fields
    for (const field of filledFields) {
      setNestedValue(mappedData, field.targetField, field.extractedValue);
    }

    // Add ambiguous field selections
    ambiguousFields.forEach((field, index) => {
      const selectedTarget = ambiguousSelections[index];
      if (selectedTarget && selectedTarget !== "ignore") {
        setNestedValue(mappedData, selectedTarget, field.extractedValue);
      }
    });

    // Add unmapped item selections
    unmappedItems.forEach((item, index) => {
      const selectedTarget = unmappedSelections[index];
      if (selectedTarget && selectedTarget !== "ignore") {
        setNestedValue(mappedData, selectedTarget, item.extractedValue);
      }
    });

    onConfirm(mappedData);
  };

  const handleClose = () => {
    setAmbiguousSelections({});
    setUnmappedSelections({});
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

        {/* Metadata */}
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{metadata.fileName}</span>
          <span>•</span>
          <span>{(metadata.fileSize / 1024).toFixed(0)} KB</span>
          <span>•</span>
          <span>{metadata.extractionMethod === "ocr" ? "OCR" : "Text"}</span>
          <span>•</span>
          <span>{(metadata.processingTimeMs / 1000).toFixed(1)}s</span>
        </div>

        <ScrollArea className="h-[50vh]">
          {/* Filled Fields */}
          {filledFields.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Erfolgreich zugeordnet ({filledFields.length})
              </h3>
              <div className="space-y-2">
                {filledFields.map((field, index) => (
                  <div
                    key={index}
                    className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{field.targetField}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {String(field.extractedValue)}
                        </div>
                      </div>
                      <Badge
                        variant={field.confidence === "high" ? "default" : field.confidence === "medium" ? "secondary" : "outline"}
                      >
                        {field.confidence}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filledFields.length > 0 && (ambiguousFields.length > 0 || unmappedItems.length > 0) && (
            <Separator className="my-4" />
          )}

          {/* Ambiguous Fields */}
          {ambiguousFields.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Mehrdeutige Zuordnungen ({ambiguousFields.length})
              </h3>
              <div className="space-y-3">
                {ambiguousFields.map((field, index) => (
                  <AmbiguousFieldRow
                    key={index}
                    field={field}
                    selectedTarget={ambiguousSelections[index]}
                    onChange={(value) => handleAmbiguousChange(index, value)}
                  />
                ))}
              </div>
            </div>
          )}

          {ambiguousFields.length > 0 && unmappedItems.length > 0 && (
            <Separator className="my-4" />
          )}

          {/* Unmapped Items */}
          {unmappedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-gray-600" />
                Nicht zugeordnet ({unmappedItems.length})
              </h3>
              <div className="space-y-3">
                {unmappedItems.map((item, index) => (
                  <UnmappedItemRow
                    key={index}
                    item={item}
                    selectedTarget={unmappedSelections[index]}
                    onChange={(value) => handleUnmappedChange(index, value)}
                  />
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

// Helper component for ambiguous fields
function AmbiguousFieldRow({
  field,
  selectedTarget,
  onChange,
}: {
  field: AmbiguousField;
  selectedTarget: string | null | undefined;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
      <div className="mb-2">
        <div className="text-sm font-medium">{field.extractedLabel}</div>
        <div className="text-sm text-muted-foreground">{field.extractedValue}</div>
      </div>
      <select
        className="w-full mt-2 p-2 border rounded text-sm"
        value={selectedTarget || field.suggestedTargets[0]?.targetField || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {field.suggestedTargets.map((target, idx) => (
          <option key={idx} value={target.targetField}>
            {target.targetField} ({target.confidence}) - {target.reason}
          </option>
        ))}
        <option value="ignore">Ignorieren</option>
      </select>
    </div>
  );
}

// Helper component for unmapped items
function UnmappedItemRow({
  item,
  selectedTarget,
  onChange,
}: {
  item: UnmappedItem;
  selectedTarget: string | null | undefined;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="mb-2">
        {item.extractedLabel && (
          <div className="text-sm font-medium">{item.extractedLabel}</div>
        )}
        <div className="text-sm text-muted-foreground">{item.extractedValue}</div>
        {item.category && (
          <Badge variant="outline" className="mt-1">{item.category}</Badge>
        )}
      </div>
      {item.suggestedTargets.length > 0 && (
        <select
          className="w-full mt-2 p-2 border rounded text-sm"
          value={selectedTarget || ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">-- Zielfeld wählen --</option>
          {item.suggestedTargets.map((target, idx) => (
            <option key={idx} value={target.targetField}>
              {target.targetField} ({target.confidence}) - {target.reason}
            </option>
          ))}
          <option value="ignore">Ignorieren</option>
        </select>
      )}
    </div>
  );
}

// Helper function to set nested object values
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
  // Handle array indices like "experience[0].company"
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

  // Handle simple array like "skills"
  if (!path.includes('.') && !path.includes('[')) {
    obj[path] = value;
    return;
  }

  // Handle other nested paths if needed
  obj[path] = value;
}
