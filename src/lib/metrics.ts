import "server-only";

interface MetricEntry {
  count: number;
  sum: number;
  min: number;
  max: number;
  lastUpdated: number;
}

interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, { count: number; avg: number; min: number; max: number }>;
  timestamp: string;
}

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, MetricEntry> = new Map();
  private startTime: number = Date.now();

  increment(name: string, value: number = 1, labels?: Record<string, string>) {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>) {
    const key = this.buildKey(name, labels);
    const entry = this.histograms.get(key) || { count: 0, sum: 0, min: Infinity, max: -Infinity, lastUpdated: 0 };
    
    entry.count++;
    entry.sum += value;
    entry.min = Math.min(entry.min, value);
    entry.max = Math.max(entry.max, value);
    entry.lastUpdated = Date.now();
    
    this.histograms.set(key, entry);
  }

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return `${name}{${labelStr}}`;
  }

  getSnapshot(): MetricsSnapshot {
    const counters: Record<string, number> = {};
    const histograms: Record<string, { count: number; avg: number; min: number; max: number }> = {};

    for (const [key, value] of this.counters) {
      counters[key] = value;
    }

    for (const [key, entry] of this.histograms) {
      histograms[key] = {
        count: entry.count,
        avg: entry.count > 0 ? entry.sum / entry.count : 0,
        min: entry.min === Infinity ? 0 : entry.min,
        max: entry.max === -Infinity ? 0 : entry.max,
      };
    }

    return {
      counters,
      histograms,
      timestamp: new Date().toISOString(),
    };
  }

  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.startTime = Date.now();
  }
}

export const metrics = new MetricsCollector();

export const CV_METRICS = {
  ANALYSIS_STARTED: "cv_analysis_started_total",
  ANALYSIS_SUCCESS: "cv_analysis_success_total",
  ANALYSIS_FAILED: "cv_analysis_failed_total",
  ANALYSIS_TIMEOUT: "cv_analysis_timeout_total",
  ANALYSIS_DEDUPE_HIT: "cv_analysis_dedupe_hit_total",
  ANALYSIS_RATE_LIMITED: "cv_analysis_rate_limited_total",
  ANALYSIS_QUOTA_EXCEEDED: "cv_analysis_quota_exceeded_total",
  ANALYSIS_LATENCY_MS: "cv_analysis_latency_ms",
  ANALYSIS_PAGES: "cv_analysis_pages",
  EXTRACTION_AUTOFILL_FIELDS: "cv_extraction_autofill_fields",
  EXTRACTION_REVIEW_FIELDS: "cv_extraction_review_fields",
  EXTRACTION_SKIP_FIELDS: "cv_extraction_skip_fields",
};

