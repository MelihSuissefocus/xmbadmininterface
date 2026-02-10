"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import {
  CvDesignConfigSchema,
  DEFAULT_DESIGN_CONFIG,
  type CvDesignConfig,
  type CvContentData,
} from "@/lib/cv-generator/schema";
import { loadCandidateForCv } from "@/actions/cv-generator";
import { DesignControls } from "./design-controls";
import { CandidateSelector } from "./candidate-selector";
import { PdfPreview } from "./pdf-preview";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

// ─── Local Storage Helpers ────────────────────────────────────────────────────

const STORAGE_KEY = "cv-generator-design-defaults";

function loadDefaults(): CvDesignConfig {
  if (typeof window === "undefined") return DEFAULT_DESIGN_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DESIGN_CONFIG;
    const parsed = CvDesignConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_DESIGN_CONFIG;
  } catch {
    return DEFAULT_DESIGN_CONFIG;
  }
}

function saveDefaults(config: CvDesignConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // storage full – ignore silently
  }
}

// ─── Placeholder Content ──────────────────────────────────────────────────────

const EMPTY_DATA: CvContentData = {
  personal: {
    firstName: "Vorname",
    lastName: "Nachname",
    targetRole: "Position wird geladen…",
  },
  experience: [],
  education: [],
  skills: [],
  languages: [],
  certificates: [],
  highlights: ["Bitte wählen Sie einen Kandidaten aus."],
};

// ─── Shell ────────────────────────────────────────────────────────────────────

interface CvEditorShellProps {
  candidates: { id: string; firstName: string; lastName: string }[];
}

export function CvEditorShell({ candidates }: CvEditorShellProps) {
  const [selectedId, setSelectedId] = useState("");
  const [cvData, setCvData] = useState<CvContentData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);

  // Form with saved defaults
  const methods = useForm<CvDesignConfig>({
    defaultValues: loadDefaults(),
    mode: "onChange",
  });

  const designConfig = methods.watch();

  // ── Candidate loading ────────────────────────────────────────────────────
  const handleCandidateChange = useCallback(async (id: string) => {
    setSelectedId(id);
    setLoading(true);
    try {
      const data = await loadCandidateForCv(id);
      setCvData(data ?? EMPTY_DATA);
    } catch {
      setCvData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Save branding defaults ───────────────────────────────────────────────
  const handleSaveDefaults = useCallback(() => {
    const current = methods.getValues();
    saveDefaults(current);
  }, [methods]);

  // Stable config reference for PDFViewer (avoids re-render on every keystroke)
  const stableConfig = useMemo(() => designConfig, [
    designConfig.global.primaryColor,
    designConfig.global.fontFamily,
    designConfig.global.baseFontSize,
    designConfig.global.lineHeight,
    designConfig.header.logoUrl,
    designConfig.header.logoWidth,
    designConfig.header.logoPosition,
    designConfig.header.companyName,
    designConfig.header.companySlogan,
    designConfig.header.showCompanyInfo,
    designConfig.layout.sidebarWidth,
    designConfig.layout.pageMargin,
    designConfig.sections.showPhoto,
    designConfig.sections.showSignature,
    designConfig.typography.headingSize,
    designConfig.typography.bodySize,
  ]);

  return (
    <FormProvider {...methods}>
      {/* ── Top Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b bg-white dark:bg-slate-900 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">CV-Generator</h1>
        </div>
        <CandidateSelector
          candidates={candidates}
          value={selectedId}
          onChange={handleCandidateChange}
          loading={loading}
        />
      </div>

      {/* ── Split View ────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Controls */}
        <ScrollArea className="w-80 shrink-0 border-r bg-white dark:bg-slate-900">
          <div className="p-4">
            <DesignControls onSaveDefaults={handleSaveDefaults} />
          </div>
        </ScrollArea>

        {/* Right: Live Preview */}
        <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950">
          <PdfPreview data={cvData} config={stableConfig} />
        </div>
      </div>
    </FormProvider>
  );
}
