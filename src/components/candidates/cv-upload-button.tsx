"use client";

/**
 * CV Upload Button Component
 * Trigger button for CV upload and extraction
 */

import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCV } from "@/actions/cv-upload";
import { extractFromCV } from "@/actions/cv-extraction";
import type { CandidateAutoFillDraft } from "@/lib/cv-autofill/types";

export interface CVUploadButtonProps {
  onUploadComplete: (draft: CandidateAutoFillDraft) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function CVUploadButton({
  onUploadComplete,
  onError,
  disabled = false,
}: CVUploadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append("file", file);

      const uploadResult = await uploadCV(formData);

      if (!uploadResult.success) {
        onError(uploadResult.error || "Upload fehlgeschlagen");
        setIsLoading(false);
        return;
      }

      // Step 2: Extract data from file
      const draft = await extractFromCV(
        uploadResult.base64!,
        uploadResult.fileName!,
        uploadResult.fileType!,
        uploadResult.fileSize!
      );

      onUploadComplete(draft);
    } catch (error) {
      console.error("CV upload error:", error);
      onError("Ein Fehler ist beim Upload aufgetreten");
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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
        variant="outline"
        className="w-full sm:w-auto"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            CV wird analysiert...
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
