"use server";

/**
 * CV Upload Action
 * Handles file upload with validation and buffer conversion
 */

import { CV_AUTOFILL_CONFIG } from "@/lib/constants";

export interface UploadResult {
  success: boolean;
  base64?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  error?: string;
}

export async function uploadCV(formData: FormData): Promise<UploadResult> {
  try {
    const file = formData.get("file") as File | null;

    if (!file) {
      return {
        success: false,
        error: "Keine Datei ausgewählt",
      };
    }

    // Validate file size
    const maxSizeBytes = CV_AUTOFILL_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        success: false,
        error: `Datei ist zu groß. Maximum: ${CV_AUTOFILL_CONFIG.MAX_FILE_SIZE_MB} MB`,
      };
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = CV_AUTOFILL_CONFIG.ALLOWED_FILE_TYPES;

    if (!fileExtension || !allowedExtensions.includes(fileExtension as typeof allowedExtensions[number])) {
      return {
        success: false,
        error: "Nur PDF, PNG, JPG oder DOCX erlaubt",
      };
    }

    // Validate MIME type as well
    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpg",
      "image/jpeg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return {
        success: false,
        error: "Ungültiger Dateityp",
      };
    }

    // Convert file to base64 for safe transport between client/server
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      success: true,
      base64,
      fileName: file.name,
      fileType: fileExtension,
      fileSize: file.size,
    };
  } catch (error) {
    console.error("CV upload error:", error);
    return {
      success: false,
      error: "Ein Fehler ist beim Upload aufgetreten",
    };
  }
}

export async function validateCVFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // Validate file size
  const maxSizeBytes = CV_AUTOFILL_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Datei ist zu groß. Maximum: ${CV_AUTOFILL_CONFIG.MAX_FILE_SIZE_MB} MB`,
    };
  }

  // Validate file type
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = CV_AUTOFILL_CONFIG.ALLOWED_FILE_TYPES;

  if (!fileExtension || !allowedExtensions.includes(fileExtension as typeof allowedExtensions[number])) {
    return {
      valid: false,
      error: "Nur PDF, PNG, JPG oder DOCX erlaubt",
    };
  }

  return { valid: true };
}
