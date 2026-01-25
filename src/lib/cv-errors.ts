export type CVErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INSUFFICIENT"
  | "RATE_LIMITED"
  | "DAILY_QUOTA_EXCEEDED"
  | "TENANT_QUOTA_EXCEEDED"
  | "FILE_TOO_LARGE"
  | "FILE_INVALID_TYPE"
  | "FILE_MAGIC_MISMATCH"
  | "FILE_TOO_MANY_PAGES"
  | "ANALYSIS_TIMEOUT"
  | "ANALYSIS_FAILED"
  | "AZURE_AUTH_FAILED"
  | "AZURE_RATE_LIMITED"
  | "JOB_NOT_FOUND"
  | "INTERNAL_ERROR";

interface CVErrorMessages {
  code: CVErrorCode;
  userMessage: string;
  internalMessage: string;
  retryable: boolean;
  httpStatus: number;
}

const ERROR_MESSAGES: Record<CVErrorCode, Omit<CVErrorMessages, "code">> = {
  AUTH_REQUIRED: {
    userMessage: "Bitte melden Sie sich an.",
    internalMessage: "Authentication required",
    retryable: false,
    httpStatus: 401,
  },
  AUTH_INSUFFICIENT: {
    userMessage: "Sie haben keine Berechtigung für diese Aktion.",
    internalMessage: "Insufficient permissions",
    retryable: false,
    httpStatus: 403,
  },
  RATE_LIMITED: {
    userMessage: "Zu viele Anfragen. Bitte warten Sie einen Moment.",
    internalMessage: "Rate limit exceeded",
    retryable: true,
    httpStatus: 429,
  },
  DAILY_QUOTA_EXCEEDED: {
    userMessage: "Tageslimit erreicht. Versuchen Sie es morgen erneut.",
    internalMessage: "Daily quota exceeded",
    retryable: false,
    httpStatus: 429,
  },
  TENANT_QUOTA_EXCEEDED: {
    userMessage: "Das Kontingent für Ihre Organisation wurde erreicht.",
    internalMessage: "Tenant quota exceeded",
    retryable: false,
    httpStatus: 429,
  },
  FILE_TOO_LARGE: {
    userMessage: "Die Datei ist zu groß. Maximum: 10 MB.",
    internalMessage: "File exceeds size limit",
    retryable: false,
    httpStatus: 413,
  },
  FILE_INVALID_TYPE: {
    userMessage: "Nur PDF, PNG, JPG oder DOCX erlaubt.",
    internalMessage: "Invalid file type",
    retryable: false,
    httpStatus: 415,
  },
  FILE_MAGIC_MISMATCH: {
    userMessage: "Die Datei scheint beschädigt oder ungültig zu sein.",
    internalMessage: "File magic bytes mismatch",
    retryable: false,
    httpStatus: 415,
  },
  FILE_TOO_MANY_PAGES: {
    userMessage: "Das Dokument hat zu viele Seiten. Maximum: 20.",
    internalMessage: "Document exceeds page limit",
    retryable: false,
    httpStatus: 413,
  },
  ANALYSIS_TIMEOUT: {
    userMessage: "Die Analyse hat zu lange gedauert. Bitte versuchen Sie es erneut.",
    internalMessage: "Analysis timeout",
    retryable: true,
    httpStatus: 504,
  },
  ANALYSIS_FAILED: {
    userMessage: "Die Analyse ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
    internalMessage: "Analysis failed",
    retryable: true,
    httpStatus: 500,
  },
  AZURE_AUTH_FAILED: {
    userMessage: "Ein Systemfehler ist aufgetreten. Bitte kontaktieren Sie den Support.",
    internalMessage: "Azure authentication failed",
    retryable: false,
    httpStatus: 500,
  },
  AZURE_RATE_LIMITED: {
    userMessage: "Der Dienst ist überlastet. Bitte versuchen Sie es später erneut.",
    internalMessage: "Azure rate limited",
    retryable: true,
    httpStatus: 503,
  },
  JOB_NOT_FOUND: {
    userMessage: "Die Analyse wurde nicht gefunden.",
    internalMessage: "Job not found",
    retryable: false,
    httpStatus: 404,
  },
  INTERNAL_ERROR: {
    userMessage: "Ein unerwarteter Fehler ist aufgetreten.",
    internalMessage: "Internal error",
    retryable: false,
    httpStatus: 500,
  },
};

export class CVError extends Error {
  readonly code: CVErrorCode;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly context?: Record<string, unknown>;

  constructor(code: CVErrorCode, context?: Record<string, unknown>) {
    const errorInfo = ERROR_MESSAGES[code];
    super(errorInfo.internalMessage);
    
    this.name = "CVError";
    this.code = code;
    this.userMessage = errorInfo.userMessage;
    this.retryable = errorInfo.retryable;
    this.httpStatus = errorInfo.httpStatus;
    this.context = context;
  }

  toUserResponse(): { success: false; message: string; code: CVErrorCode; retryable: boolean } {
    return {
      success: false,
      message: this.userMessage,
      code: this.code,
      retryable: this.retryable,
    };
  }
}

export function isCVError(error: unknown): error is CVError {
  return error instanceof CVError;
}

export function wrapError(error: unknown, fallbackCode: CVErrorCode = "INTERNAL_ERROR"): CVError {
  if (isCVError(error)) return error;
  
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes("timeout") || message.includes("abort")) {
    return new CVError("ANALYSIS_TIMEOUT");
  }
  if (message.includes("401") || message.includes("403")) {
    return new CVError("AZURE_AUTH_FAILED");
  }
  if (message.includes("429")) {
    return new CVError("AZURE_RATE_LIMITED");
  }
  
  return new CVError(fallbackCode, { originalError: message });
}

