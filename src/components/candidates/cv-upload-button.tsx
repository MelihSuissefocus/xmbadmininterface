"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCV } from "@/actions/cv-upload";
import { createCvAnalysisJob, getCvAnalysisJobStatus } from "@/actions/cv-analysis";
import type { CandidateAutoFillDraftV2 } from "@/lib/azure-di/types";

export interface CVUploadButtonProps {
  onUploadComplete: (draft: CandidateAutoFillDraftV2) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

type UploadState = "idle" | "uploading" | "processing" | "completed" | "error";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 80;

export function CVUploadButton({
  onUploadComplete,
  onError,
  disabled = false,
}: CVUploadButtonProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollCountRef = useRef(0);
  const jobIdRef = useRef<string | null>(null);

  const pollForResult = useCallback(async () => {
    if (!jobIdRef.current) return;

    pollCountRef.current++;
    if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
      setState("error");
      onError("Analyse-Timeout. Bitte versuchen Sie es erneut.");
      return;
    }

    const result = await getCvAnalysisJobStatus(jobIdRef.current);

    if (!result.success || !result.data) {
      setState("error");
      onError(result.message || "Fehler beim Abrufen des Status");
      return;
    }

    const { status, result: analysisResult, error } = result.data;

    if (status === "completed" && analysisResult) {
      setState("completed");
      onUploadComplete(analysisResult);
      setTimeout(() => setState("idle"), 2000);
      return;
    }

    if (status === "failed") {
      setState("error");
      onError(error || "Analyse fehlgeschlagen");
      setTimeout(() => setState("idle"), 3000);
      return;
    }

    if (status === "pending" || status === "processing") {
      setProgress(status === "pending" ? "In Warteschlange..." : "Wird analysiert...");
      setTimeout(pollForResult, POLL_INTERVAL_MS);
    }
  }, [onUploadComplete, onError]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState("uploading");
    setProgress("Datei wird hochgeladen...");
    pollCountRef.current = 0;
    jobIdRef.current = null;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResult = await uploadCV(formData);

      if (!uploadResult.success) {
        setState("error");
        onError(uploadResult.error || "Upload fehlgeschlagen");
        setTimeout(() => setState("idle"), 3000);
        return;
      }

      setState("processing");
      setProgress("Analyse wird gestartet...");

      const jobResult = await createCvAnalysisJob(
        uploadResult.base64!,
        uploadResult.fileName!,
        uploadResult.fileType!,
        uploadResult.fileSize!
      );

      if (!jobResult.success || !jobResult.data) {
        setState("error");
        onError(jobResult.message || "Analyse konnte nicht gestartet werden");
        setTimeout(() => setState("idle"), 3000);
        return;
      }

      jobIdRef.current = jobResult.data.jobId;
      setProgress("CV wird mit Azure AI analysiert...");
      pollForResult();
    } catch {
      setState("error");
      onError("Ein Fehler ist beim Upload aufgetreten");
      setTimeout(() => setState("idle"), 3000);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    return () => {
      jobIdRef.current = null;
    };
  }, []);

  const isLoading = state === "uploading" || state === "processing";
  const isCompleted = state === "completed";
  const isError = state === "error";

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.docx"
        onChange={handleFileChange}
        className="hidden"
        disabled={isLoading || disabled}
      />
      <Button
        type="button"
        onClick={handleClick}
        disabled={isLoading || disabled}
        variant={isCompleted ? "default" : isError ? "destructive" : "outline"}
        className="w-full sm:w-auto min-w-[280px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {progress}
          </>
        ) : isCompleted ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Erfolgreich extrahiert
          </>
        ) : isError ? (
          <>
            <AlertCircle className="mr-2 h-4 w-4" />
            Fehler - erneut versuchen
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Mit CV Felder automatisiert ausfüllen
          </>
        )}
      </Button>
    </>
  );
}
