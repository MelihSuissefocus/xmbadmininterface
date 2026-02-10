"use client";

import React, { useEffect, useState, useRef } from "react";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import type { CvDesignConfig, CvContentData } from "@/lib/cv-generator/schema";

/**
 * PDF Preview component that renders the CvPdfDocument inside an iframe.
 *
 * We avoid using `PDFViewer` from @react-pdf/renderer because Next.js
 * resolves the Node entry-point (which stubs PDFViewer with a throw).
 * Instead we use `pdf().toBlob()` on the client to generate a Blob URL
 * and display it in a plain `<iframe>`.
 */
export function PdfPreview({
  data,
  config,
}: {
  data: CvContentData;
  config: CvDesignConfig;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Debounce regeneration to avoid excessive renders during config changes
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        // Dynamic import to ensure we only load on the client
        const [{ pdf }, ironHorseModule, oehlerModule] = await Promise.all([
          import("@react-pdf/renderer"),
          import("./pdf-template"),
          import("./pdf-template-oehler"),
        ]);
        const { createElement } = await import("react");

        // Select the correct template based on config
        const TemplateComponent =
          config.template === "oehler"
            ? oehlerModule.OehlerPdfDocument
            : ironHorseModule.CvPdfDocument;

        const doc = createElement(TemplateComponent, { data, config });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = await pdf(doc as any).toBlob();

        if (cancelled) return;

        // Revoke old URL to avoid memory leaks
        if (prevUrl.current) {
          URL.revokeObjectURL(prevUrl.current);
        }

        const url = URL.createObjectURL(blob);
        prevUrl.current = url;
        setBlobUrl(url);
      } catch (err) {
        if (cancelled) return;
        console.error("PDF generation error:", err);
        setError(
          err instanceof Error ? err.message : "PDF konnte nicht erstellt werden"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, config]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-destructive max-w-md text-center px-4">
          <AlertCircle className="h-10 w-10" />
          <span className="text-sm font-medium">Fehler bei der PDF-Erzeugung</span>
          <span className="text-xs text-muted-foreground">{error}</span>
        </div>
      </div>
    );
  }

  if (loading && !blobUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin" />
          <span className="text-sm">PDF wird generiert…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/60 dark:bg-slate-950/60">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {blobUrl && (
        <iframe
          src={blobUrl}
          className="h-full w-full border-0"
          title="CV Vorschau"
        />
      )}
    </div>
  );
}
