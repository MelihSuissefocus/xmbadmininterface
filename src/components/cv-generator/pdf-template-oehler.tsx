"use client";

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
} from "@react-pdf/renderer";
import type {
  CvDesignConfig,
  CvContentData,
  CvExperienceEntry,
} from "@/lib/cv-generator/schema";
import { oehlerStyles as s, oehlerColors } from "./pdf-styles-oehler";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date?: string | null): string {
  if (!date) return "";
  if (date === "present") return "heute";
  const [year, month] = date.split("-");
  if (!month) return year;
  return `${month}.${year}`;
}

function dateRange(start?: string | null, end?: string | null): string {
  const sv = formatDate(start);
  const ev = formatDate(end);
  if (sv && ev) return `${sv} – ${ev}`;
  if (sv) return `seit ${sv}`;
  if (ev) return `bis ${ev}`;
  return "";
}

function buildFileName(personal: CvContentData["personal"]): string {
  return `CV_${personal.firstName}_${personal.lastName}`.replace(/\s+/g, "_");
}

function todayFormatted(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Categorization Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Known skill category keywords for auto-detection */
const SKILL_CATEGORIES: { label: string; keywords: string[] }[] = [
  {
    label: "Technischer Fokus & Cloud",
    keywords: [
      "cloud", "aws", "azure", "gcp", "devops", "docker", "kubernetes",
      "terraform", "ci/cd", "jenkins", "linux", "windows", "server",
      "infrastruktur", "netzwerk", "vmware", "monitoring", "ansible",
      "java", "python", "javascript", "typescript", "react", "node",
      "sql", "nosql", "postgresql", "mongodb", "redis", "api", "rest",
      "graphql", "microservices", "architecture", "backend", "frontend",
      "fullstack", "software", "entwicklung", "development", "programming",
      "it", "sap", "erp", "system", "datenbank", "database",
    ],
  },
  {
    label: "Führung & Management",
    keywords: [
      "führung", "management", "leitung", "team", "projektleitung",
      "projektmanagement", "scrum", "agile", "kanban", "prince2",
      "itil", "coaching", "mentoring", "stakeholder", "budget",
      "strategie", "organisation", "verantwortung", "koordination",
    ],
  },
  {
    label: "Sprachen",
    keywords: [
      "deutsch", "englisch", "französisch", "italienisch", "spanisch",
      "portugiesisch", "muttersprache", "verhandlungssicher", "fliessend",
      "language", "german", "english", "french", "italian",
    ],
  },
  {
    label: "Methodik & Zertifizierungen",
    keywords: [
      "zertifiz", "certif", "pmp", "togaf", "iso", "audit", "compliance",
      "isms", "datenschutz", "sicherheit", "security", "qualität", "quality",
      "analyse", "consulting", "beratung", "prozess", "methode",
    ],
  },
];

interface CategorizedSkill {
  category: string;
  items: string[];
}

/**
 * Groups skills into categories. Skills that match no category go
 * under "Weitere Kompetenzen".
 */
function categorizeSkills(
  skills: string[],
  languages: CvContentData["languages"]
): CategorizedSkill[] {
  const buckets: Record<string, string[]> = {};
  const used = new Set<string>();

  for (const cat of SKILL_CATEGORIES) {
    buckets[cat.label] = [];
  }
  buckets["Weitere Kompetenzen"] = [];

  // Sprachen immer in die Sprach-Kategorie
  if (languages.length > 0) {
    buckets["Sprachen"] = languages.map(
      (l) => `${l.language} (${l.level})`
    );
    // Mark language-like skills as used so they don't appear twice
    for (const l of languages) {
      used.add(l.language.toLowerCase());
    }
  }

  for (const skill of skills) {
    if (used.has(skill.toLowerCase())) continue;
    const lower = skill.toLowerCase();
    let placed = false;
    for (const cat of SKILL_CATEGORIES) {
      if (cat.label === "Sprachen") continue; // handled above
      if (cat.keywords.some((kw) => lower.includes(kw))) {
        buckets[cat.label].push(skill);
        placed = true;
        break;
      }
    }
    if (!placed) {
      buckets["Weitere Kompetenzen"].push(skill);
    }
  }

  // Build result – only non-empty categories
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => ({ category, items }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Employer Grouping Helper
// ─────────────────────────────────────────────────────────────────────────────

interface EmployerGroup {
  company: string;
  /** Overall span: earliest start → latest end */
  overallStart?: string | null;
  overallEnd?: string | null;
  entries: CvExperienceEntry[];
}

/**
 * Groups consecutive experience entries by company name (case-insensitive
 * & trimmed). If the same employer appears in different chronological blocks
 * they stay separate. Within a group, entries are kept in original order.
 */
function groupByEmployer(entries: CvExperienceEntry[]): EmployerGroup[] {
  if (entries.length === 0) return [];

  const groups: EmployerGroup[] = [];
  let current: EmployerGroup | null = null;

  for (const entry of entries) {
    const normalizedCompany = entry.company.trim().toLowerCase();

    if (current && current.company.trim().toLowerCase() === normalizedCompany) {
      // Same employer – merge
      current.entries.push(entry);
      // Expand overall date range
      if (entry.startDate && (!current.overallStart || entry.startDate < current.overallStart)) {
        current.overallStart = entry.startDate;
      }
      if (entry.endDate === "present") {
        current.overallEnd = "present";
      } else if (
        entry.endDate &&
        current.overallEnd !== "present" &&
        (!current.overallEnd || entry.endDate > current.overallEnd)
      ) {
        current.overallEnd = entry.endDate;
      }
    } else {
      // New employer group
      current = {
        company: entry.company,
        overallStart: entry.startDate,
        overallEnd: entry.endDate,
        entries: [entry],
      };
      groups.push(current);
    }
  }

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

interface SubProps {
  config: CvDesignConfig;
  data: CvContentData;
}

// ─── Header: Logo links, Firmendaten rechts ──────────────────────────────────

function OehlerHeader({ config }: { config: CvDesignConfig }) {
  const { header } = config;

  return (
    <View style={s.headerRow}>
      {/* Left: Logo placeholder */}
      <View style={s.headerLogoBlock}>
        {header.logoUrl ? (
          <Image
            src={header.logoUrl}
            style={[s.headerLogo, { width: header.logoWidth }]}
          />
        ) : (
          <View style={s.headerLogoPlaceholder}>
            <Text style={s.headerLogoPlaceholderText}>Logo</Text>
          </View>
        )}
      </View>

      {/* Right: Company info */}
      {header.showCompanyInfo && (
        <View style={s.headerCompanyBlock}>
          <Text style={s.headerCompanyName}>{header.companyName}</Text>
          {header.companySlogan ? (
            <Text style={s.headerCompanyService}>{header.companySlogan}</Text>
          ) : null}
          {/* Company URL placeholder – uses slogan field or generic */}
          <Text style={s.headerCompanyUrl}>www.xmb-consulting.ch</Text>
        </View>
      )}
    </View>
  );
}

// ─── Candidate Title ─────────────────────────────────────────────────────────

function CandidateTitle({ data }: { data: CvContentData }) {
  const { personal } = data;
  return (
    <View style={s.candidateTitleBar}>
      <Text style={s.candidateName}>
        {personal.firstName} {personal.lastName}
      </Text>
      {personal.targetRole && (
        <Text style={s.candidateRole}>{personal.targetRole}</Text>
      )}
    </View>
  );
}

// ─── Section Title (h2 style) ────────────────────────────────────────────────

function SectionTitle({
  title,
  isFirst,
}: {
  title: string;
  isFirst?: boolean;
}) {
  return (
    <Text
      style={[
        s.sectionTitle,
        isFirst ? { marginTop: 0 } : {},
      ]}
    >
      {title}
    </Text>
  );
}

// ─── Persönliche Daten – Compact Table (Name, Geburtsdatum, Nationalität) ───

function PersonalDataSection({ data, config }: SubProps) {
  const { personal } = data;

  // Core rows matching the Stefan Oehler reference: Name, Geburtsdatum, Nationalität
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: `${personal.firstName} ${personal.lastName}` },
  ];
  if (personal.birthDate) rows.push({ label: "Geburtsdatum", value: personal.birthDate });
  if (personal.nationality) rows.push({ label: "Staatsangehörigkeit", value: personal.nationality });
  const wohnort = [personal.city, personal.canton].filter(Boolean).join(", ");
  if (wohnort) rows.push({ label: "Wohnort", value: wohnort });
  if (personal.email) rows.push({ label: "E-Mail", value: personal.email });
  if (personal.phone) rows.push({ label: "Telefon", value: personal.phone });

  return (
    <View>
      <SectionTitle title="Persönliche Daten" isFirst />

      {config.sections.showPhoto && personal.photoUrl ? (
        <View style={s.photoRow}>
          <Image src={personal.photoUrl} style={s.photo} />
          <View style={{ flex: 1 }}>
            <View style={s.personalCompactTable}>
              {rows.map((row, i) => (
                <View
                  key={i}
                  style={
                    i < rows.length - 1
                      ? s.personalCompactRow
                      : s.personalCompactRowLast
                  }
                >
                  <Text style={s.personalCompactLabel}>{row.label}</Text>
                  <Text style={s.personalCompactValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={s.personalCompactTable}>
          {rows.map((row, i) => (
            <View
              key={i}
              style={
                i < rows.length - 1
                  ? s.personalCompactRow
                  : s.personalCompactRowLast
              }
            >
              <Text style={s.personalCompactLabel}>{row.label}</Text>
              <Text style={s.personalCompactValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Kurzprofil / Summary-Box ────────────────────────────────────────────────

/**
 * Summary-Box at the top of page 1. Combines highlights from the DB
 * with auto-categorized skills into a structured bullet list with
 * bold category prefixes (e.g. "Technischer Fokus & Cloud:").
 */
function KurzprofilSection({ data }: { data: CvContentData }) {
  const { highlights, skills, languages } = data;

  // Categorize skills into labelled groups
  const categories = categorizeSkills(skills, languages);

  // If we have neither highlights nor skills, render nothing
  if (highlights.length === 0 && categories.length === 0) return null;

  return (
    <View>
      <SectionTitle title="Kurzprofil" />
      <View style={s.summaryBox}>
        {/* Free-text highlights first */}
        {highlights.map((h, i) => (
          <View key={`h-${i}`} style={s.summaryBulletRow}>
            <Text style={s.summaryBulletDot}>•</Text>
            <Text style={s.summaryBulletText}>{h}</Text>
          </View>
        ))}

        {/* Categorized competencies with bold prefixes */}
        {categories.map((cat, ci) => (
          <View key={`c-${ci}`} style={s.summaryBulletRow}>
            <Text style={s.summaryBulletDot}>•</Text>
            <Text style={s.summaryBulletText}>
              <Text style={s.summaryBoldCategory}>{cat.category}: </Text>
              {cat.items.join(", ")}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Ausbildung Section (25/75 Table) ────────────────────────────────────────

function EducationSection({ data }: { data: CvContentData }) {
  if (data.education.length === 0) return null;

  return (
    <View>
      <SectionTitle title="Ausbildung" />
      {data.education.map((ed, i) => {
        const yearStart = ed.startDate?.split("-")[0];
        const yearEnd = ed.endDate?.split("-")[0];
        const yearLabel =
          yearStart && yearEnd
            ? `${yearStart} – ${yearEnd}`
            : yearStart
              ? `seit ${yearStart}`
              : yearEnd ?? "";

        return (
          <View key={i} style={s.tableRow}>
            <View style={s.tableDateCol}>
              <Text style={s.tableDateText}>{yearLabel}</Text>
            </View>
            <View style={s.tableDetailCol}>
              <Text style={s.detailTitle}>{ed.degree}</Text>
              <Text style={s.detailSubtitle}>{ed.institution}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Single Role Entry (within an employer group) ───────────────────────────

/**
 * Renders a single role/position within a grouped employer block.
 * Shows "Funktion: <role>" in italic, sub-date if the group has
 * multiple entries, and bullet-point tasks.
 */
function RoleEntry({
  entry,
  showSubDate,
}: {
  entry: CvExperienceEntry;
  showSubDate: boolean;
}) {
  const descriptionLines = entry.description
    ? entry.description.split("\n").filter((l) => l.trim())
    : [];
  const hasBullets = descriptionLines.length > 1;

  return (
    <View style={s.roleEntry}>
      {/* Sub-date line (shown when multiple roles at same employer) */}
      {showSubDate && (
        <Text style={s.roleSubDateText}>
          {dateRange(entry.startDate, entry.endDate)}
        </Text>
      )}

      {/* Funktion: Role (italic) */}
      <Text style={s.roleFunktionText}>
        <Text style={s.roleFunktionPrefix}>Funktion: </Text>
        {entry.role}
      </Text>

      {/* Task descriptions as bullets */}
      {hasBullets
        ? descriptionLines.map((line, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>
                {line.replace(/^[•\-–]\s*/, "")}
              </Text>
            </View>
          ))
        : entry.description && (
            <Text style={s.detailDescription}>{entry.description}</Text>
          )}

      {/* Technologies */}
      {entry.technologies && entry.technologies.length > 0 && (
        <Text style={s.detailTech}>
          {entry.technologies.join(" · ")}
        </Text>
      )}
    </View>
  );
}

// ─── Employer Group Block ────────────────────────────────────────────────────

/**
 * Renders a single employer group:
 * - Left col (25%): overall date range
 * - Right col (75%): Company name (bold), then each role entry
 */
function EmployerGroupBlock({ group }: { group: EmployerGroup }) {
  const hasMultipleRoles = group.entries.length > 1;

  return (
    <View wrap={false} style={s.employerGroupSeparator}>
      <View style={s.employerGroupHeader}>
        {/* Left: Overall date range */}
        <View style={s.employerGroupDateCol}>
          <Text style={s.employerGroupDateText}>
            {dateRange(group.overallStart, group.overallEnd)}
          </Text>
        </View>

        {/* Right: Company + Roles */}
        <View style={s.employerGroupDetailCol}>
          <Text style={s.employerGroupName}>{group.company}</Text>

          {group.entries.map((entry, i) => (
            <RoleEntry
              key={i}
              entry={entry}
              showSubDate={hasMultipleRoles}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Werdegang Section (with Employer Grouping) ──────────────────────────────

function ExperienceSection({ data }: { data: CvContentData }) {
  const projects = data.experience.filter(
    (e) => (e.type ?? "project") === "project"
  );
  const permanent = data.experience.filter((e) => e.type === "permanent");

  const projectGroups = groupByEmployer(projects);
  const permanentGroups = groupByEmployer(permanent);

  return (
    <View>
      {projectGroups.length > 0 && (
        <>
          <SectionTitle title="Beruflicher Werdegang" />
          {projectGroups.map((group, i) => (
            <EmployerGroupBlock key={i} group={group} />
          ))}
        </>
      )}
      {permanentGroups.length > 0 && (
        <>
          <SectionTitle title="Festanstellungen" />
          {permanentGroups.map((group, i) => (
            <EmployerGroupBlock key={i} group={group} />
          ))}
        </>
      )}
    </View>
  );
}

// ─── Sprachen Section (25/75 Table) – Standalone fallback ────────────────────
// Note: Languages are already included in the Kurzprofil summary-box via
// skill categorization. This section renders only if there are languages
// but zero skills (so the summary-box wouldn't show them).

function LanguagesSection({ data }: { data: CvContentData }) {
  // Skip if skills exist (languages are already in summary-box)
  if (data.languages.length === 0 || data.skills.length > 0) return null;

  return (
    <View>
      <SectionTitle title="Sprachen" />
      {data.languages.map((l, i) => (
        <View key={i} style={s.langRow}>
          <Text style={s.langLabel}>{l.language}</Text>
          <Text style={s.langValue}>{l.level}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Zertifikate Section (25/75 Table) ───────────────────────────────────────

function CertificatesSection({ data }: { data: CvContentData }) {
  if (data.certificates.length === 0) return null;

  return (
    <View>
      <SectionTitle title="Zertifikate" />
      {data.certificates.map((cert, i) => {
        const yearLabel = cert.date?.split("-")[0] ?? "";
        return (
          <View key={i} style={s.certRow}>
            <View style={s.certDateCol}>
              <Text style={s.certDateText}>{yearLabel}</Text>
            </View>
            <View style={s.certDetailCol}>
              <Text style={s.certName}>{cert.name}</Text>
              {cert.issuer && (
                <Text style={s.certIssuer}>{cert.issuer}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Skills / Kompetenzen Section ────────────────────────────────────────────

function SkillsSection({
  data,
  config,
}: SubProps) {
  if (data.skills.length === 0) return null;

  const cols = 3;
  const rows: string[][] = [];
  for (let i = 0; i < data.skills.length; i += cols) {
    rows.push(data.skills.slice(i, i + cols));
  }

  return (
    <View>
      <SectionTitle title="Kompetenzen" />
      {rows.map((row, ri) => (
        <View key={ri} style={s.skillRow}>
          {row.map((skill, si) => (
            <View
              key={si}
              style={[s.skillCell, { width: `${100 / cols}%` }]}
            >
              <View
                style={[
                  s.skillDot,
                  {
                    backgroundColor:
                      config.global.primaryColor || oehlerColors.accent,
                  },
                ]}
              />
              <Text style={s.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Footer (fixed, jede Seite) ──────────────────────────────────────────────

function OehlerFooter({ data }: { data: CvContentData }) {
  const fileName = buildFileName(data.personal);

  return (
    <View style={s.footer} fixed>
      {/* Left: Dateiname + Datum */}
      <View style={s.footerLeft}>
        <Text style={s.footerText}>
          {fileName}  |  {todayFormatted()}
        </Text>
      </View>
      {/* Right: Seite X/Y */}
      <Text
        style={s.footerPageNumber}
        render={({ pageNumber, totalPages }) =>
          `Seite ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Document – Stefan Oehler Template
// ─────────────────────────────────────────────────────────────────────────────

interface OehlerPdfDocumentProps {
  data: CvContentData;
  config: CvDesignConfig;
}

export function OehlerPdfDocument({ data, config }: OehlerPdfDocumentProps) {
  const pageMarginPt = (config.layout.pageMargin || 20) * 2.835; // mm → pt

  const pageOverrides = {
    paddingHorizontal: pageMarginPt,
    paddingTop: pageMarginPt,
    paddingBottom: pageMarginPt + 20,
  } as const;

  return (
    <Document
      title={`CV – ${data.personal.firstName} ${data.personal.lastName}`}
      author={config.header.companyName}
    >
      {/* ── Page 1: Persönliche Daten + Kurzprofil + Ausbildung ── */}
      <Page size="A4" style={[s.page, pageOverrides]} wrap>
        <OehlerHeader config={config} />
        <CandidateTitle data={data} />
        <PersonalDataSection data={data} config={config} />
        <KurzprofilSection data={data} />
        <EducationSection data={data} />
        <LanguagesSection data={data} />
        <OehlerFooter data={data} />
      </Page>

      {/* ── Page 2+: Werdegang + Zertifikate ─────────────────── */}
      <Page size="A4" style={[s.page, pageOverrides]} wrap>
        <OehlerHeader config={config} />
        <ExperienceSection data={data} />
        <CertificatesSection data={data} />
        <OehlerFooter data={data} />
      </Page>

      {/* ── Skills Page (optional) ───────────────────────────── */}
      {data.skills.length > 0 && (
        <Page size="A4" style={[s.page, pageOverrides]}>
          <OehlerHeader config={config} />
          <SkillsSection data={data} config={config} />
          <OehlerFooter data={data} />
        </Page>
      )}
    </Document>
  );
}

export default OehlerPdfDocument;
