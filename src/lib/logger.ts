import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  component?: string;
  userId?: string;
  jobId?: string;
  action?: string;
  durationMs?: number;
  [key: string]: unknown;
}

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, replacement: "[PHONE]" },
  { pattern: /\b\d{13,19}\b/g, replacement: "[CARD]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { pattern: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g, replacement: "[AHV]" },
  { pattern: /\b[A-Z][a-zäöüéèà]+\s+[A-Z][a-zäöüéèà]+\b/g, replacement: "[NAME]" },
  { pattern: /\b\d{4,5}\s+[A-Za-zäöüéèà]+\b/g, replacement: "[ADDRESS]" },
  { pattern: /\b(strasse|street|rue|via)\s*\d+[a-z]?\b/gi, replacement: "[STREET]" },
];

function redactPII(value: unknown): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const { pattern, replacement } of PII_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }
  
  if (Array.isArray(value)) {
    return value.map(redactPII);
  }
  
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const sensitiveKeys = ["email", "phone", "name", "firstName", "lastName", "address", "street"];
      if (sensitiveKeys.some((sk) => k.toLowerCase().includes(sk))) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = redactPII(v);
      }
    }
    return result;
  }
  
  return value;
}

function formatLogEntry(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const redactedContext = context ? redactPII(context) : {};
  
  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    context?.component ? `[${context.component}]` : "",
    message,
  ].filter(Boolean);

  const contextStr = Object.keys(redactedContext as object).length > 0
    ? ` ${JSON.stringify(redactedContext)}`
    : "";

  return parts.join(" ") + contextStr;
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  const minLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
  return levels.indexOf(level) >= levels.indexOf(minLevel);
}

class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  private log(level: LogLevel, message: string, context?: Omit<LogContext, "component">) {
    if (!shouldLog(level)) return;
    
    const entry = formatLogEntry(level, message, { ...context, component: this.component });
    
    switch (level) {
      case "error":
        console.error(entry);
        break;
      case "warn":
        console.warn(entry);
        break;
      default:
        console.log(entry);
    }
  }

  debug(message: string, context?: Omit<LogContext, "component">) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Omit<LogContext, "component">) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Omit<LogContext, "component">) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Omit<LogContext, "component">) {
    this.log("error", message, context);
  }
}

export function createLogger(component: string): Logger {
  return new Logger(component);
}

export const cvLogger = createLogger("CV-EXTRACTION");

