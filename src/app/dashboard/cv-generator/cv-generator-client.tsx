"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Check,
  User,
  MapPin,
  Briefcase,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CandidateItem {
  id: string;
  firstName: string;
  lastName: string;
  targetRole: string | null;
  city: string | null;
}

type Variant = "customer" | "internal";

interface GenerateResult {
  pdfUrl: string;
  createdAt: string;
  candidateId: string;
  variant: string;
}

interface CvGeneratorClientProps {
  candidates: CandidateItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CvGeneratorClient({ candidates }: CvGeneratorClientProps) {
  // ── State ────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [variant, setVariant] = useState<Variant>("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Derived ──────────────────────────────────────────────
  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedId) ?? null,
    [candidates, selectedId],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.targetRole?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  // ── Close dropdown on outside click ──────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Handlers ─────────────────────────────────────────────
  function handleSelect(id: string) {
    setSelectedId(id);
    setSearch("");
    setDropdownOpen(false);
    setResult(null);
    setError(null);
  }

  function handleClear() {
    setSelectedId(null);
    setSearch("");
    setResult(null);
    setError(null);
  }

  async function handleGenerate() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/cv-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: selectedId, variant }),
      });

      const json = await res.json();

      if (!res.ok) {
        let errorMessage = json.error ?? `Fehler ${res.status}`;
        if (json.message) {
          errorMessage += `: ${json.message}`;
        }
        setError(errorMessage);
        return;
      }

      setResult(json as GenerateResult);
    } catch {
      setError("Netzwerkfehler – bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      {/* ─── Left: Controls ─── */}
      <div className="space-y-5">
        {/* Candidate picker */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Kandidat
          </label>

          {selected ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">
                {selected.firstName} {selected.lastName}
              </span>
              {selected.targetRole && (
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  – {selected.targetRole}
                </span>
              )}
              <button
                onClick={handleClear}
                className="ml-auto p-0.5 rounded hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div ref={wrapperRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kandidat suchen…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  className="pl-9"
                />
              </div>

              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Keine Kandidaten gefunden
                    </p>
                  ) : (
                    filtered.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelect(c.id)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                      >
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {c.firstName} {c.lastName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.targetRole && (
                              <span className="flex items-center gap-0.5 truncate">
                                <Briefcase className="h-3 w-3" />
                                {c.targetRole}
                              </span>
                            )}
                            {c.city && (
                              <span className="flex items-center gap-0.5 truncate">
                                <MapPin className="h-3 w-3" />
                                {c.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Variant toggle */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Variante
          </label>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => {
                setVariant("customer");
                setResult(null);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${variant === "customer"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted/60"
                }`}
            >
              Kunden-CV
            </button>
            <button
              onClick={() => {
                setVariant("internal");
                setResult(null);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${variant === "internal"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted/60"
                }`}
            >
              Intern
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {variant === "customer"
              ? "Ohne persönliche Kontaktdaten (E-Mail, Telefon)"
              : "Mit allen Kontaktdaten"}
          </p>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={!selectedId || loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generiere…
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              CV generieren
            </>
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success metadata */}
        {result && (
          <div className="rounded-md border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              PDF erstellt
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Variante</dt>
              <dd>{result.variant === "customer" ? "Kunden-CV" : "Intern"}</dd>
              <dt className="text-muted-foreground">Erstellt</dt>
              <dd>
                {new Date(result.createdAt).toLocaleString("de-CH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </dd>
            </dl>

            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Right: PDF Preview ─── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden min-h-[500px] lg:min-h-0">
        {result ? (
          <iframe
            src={result.pdfUrl}
            title="CV Preview"
            className="w-full h-full min-h-[600px] lg:min-h-[calc(100vh-200px)]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
            <FileText className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">
              {selectedId
                ? "Klicke auf «CV generieren» um die Vorschau zu sehen"
                : "Wähle einen Kandidaten aus"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
