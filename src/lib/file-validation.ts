import "server-only";

const FILE_SIGNATURES: Record<string, { signature: number[]; offset: number }[]> = {
  "application/pdf": [{ signature: [0x25, 0x50, 0x44, 0x46], offset: 0 }],
  "image/png": [{ signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 }],
  "image/jpeg": [
    { signature: [0xff, 0xd8, 0xff, 0xe0], offset: 0 },
    { signature: [0xff, 0xd8, 0xff, 0xe1], offset: 0 },
    { signature: [0xff, 0xd8, 0xff, 0xe2], offset: 0 },
    { signature: [0xff, 0xd8, 0xff, 0xe3], offset: 0 },
    { signature: [0xff, 0xd8, 0xff, 0xe8], offset: 0 },
    { signature: [0xff, 0xd8, 0xff, 0xdb], offset: 0 },
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    { signature: [0x50, 0x4b, 0x03, 0x04], offset: 0 },
  ],
};

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export interface FileValidationResult {
  valid: boolean;
  mimeType?: string;
  error?: string;
}

export function validateFileMagicBytes(
  bytes: Uint8Array,
  declaredMimeType: string
): FileValidationResult {
  const signatures = FILE_SIGNATURES[declaredMimeType];

  if (!signatures) {
    return { valid: false, error: "Unsupported file type" };
  }

  const matchesSignature = signatures.some((sig) => {
    if (bytes.length < sig.offset + sig.signature.length) {
      return false;
    }
    return sig.signature.every(
      (byte, i) => bytes[sig.offset + i] === byte
    );
  });

  if (!matchesSignature) {
    return {
      valid: false,
      error: "File content does not match declared type",
    };
  }

  return { valid: true, mimeType: declaredMimeType };
}

export function getMimeTypeFromExtension(extension: string): string | undefined {
  return EXTENSION_TO_MIME[extension.toLowerCase()];
}

export function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "")
    .substring(0, 255);

  if (!sanitized || sanitized === "_") {
    return `file_${Date.now()}`;
  }

  return sanitized;
}

export function validateFileSize(
  sizeBytes: number,
  maxSizeMB: number
): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `File size ${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds maximum ${maxSizeMB}MB`,
    };
  }
  return { valid: true };
}

export async function detectFileType(
  bytes: Uint8Array
): Promise<{ mimeType: string | null; extension: string | null }> {
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    const matches = signatures.some((sig) => {
      if (bytes.length < sig.offset + sig.signature.length) return false;
      return sig.signature.every((byte, i) => bytes[sig.offset + i] === byte);
    });
    if (matches) {
      const ext = Object.entries(EXTENSION_TO_MIME).find(
        ([, mime]) => mime === mimeType
      )?.[0];
      return { mimeType, extension: ext || null };
    }
  }
  return { mimeType: null, extension: null };
}

