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
import { styles, colors } from "./pdf-styles";

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
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `seit ${s}`;
  if (e) return `bis ${e}`;
  return "";
}

/** Generate a file name for the footer: "CV_Vorname_Nachname" */
function buildFileName(personal: CvContentData["personal"]): string {
  return `CV_${personal.firstName}_${personal.lastName}`.replace(/\s+/g, "_");
}

/** Get today's date formatted as dd.mm.yyyy */
function todayFormatted(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

interface SubProps {
  config: CvDesignConfig;
  data: CvContentData;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 – Iron Horse Cover Page (Stefan Oehler Reference)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Top-right block: Logo + Company address lines
 */
function Page1Header({ config }: { config: CvDesignConfig }) {
  const { header } = config;

  return (
    <View style={styles.page1TopRow}>
      <View style={styles.page1LogoBlock}>
        {header.logoUrl ? (
          <Image
            src={header.logoUrl}
            style={[styles.page1Logo, { width: header.logoWidth }]}
          />
        ) : (
          <Text
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: colors.heading,
              textAlign: "right",
              marginBottom: 6,
            }}
          >
            {header.companyName}
          </Text>
        )}
        {header.showCompanyInfo && (
          <View>
            <Text style={styles.page1CompanyAddress}>
              {header.companyName}
            </Text>
            {header.companySlogan ? (
              <Text style={styles.page1CompanyAddress}>
                {header.companySlogan}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Large candidate photo – left aligned
 */
function Page1Photo({
  config,
  data,
}: SubProps) {
  const { sections } = config;
  const { personal } = data;

  return (
    <View style={styles.page1PhotoRow}>
      {sections.showPhoto && personal.photoUrl ? (
        <Image src={personal.photoUrl} style={styles.page1Photo} />
      ) : (
        <View style={styles.page1PhotoPlaceholder}>
          <Text style={styles.page1PhotoPlaceholderText}>Foto</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Name + "Dossier" title
 */
function Page1NameBlock({ data }: { data: CvContentData }) {
  const { personal } = data;
  return (
    <View style={styles.page1NameBar}>
      <Text style={styles.page1Name}>
        {personal.firstName} {personal.lastName}
      </Text>
      <Text style={styles.page1DossierTitle}>
        Dossier {personal.firstName} {personal.lastName}
        {personal.targetRole ? ` – ${personal.targetRole}` : ""}
      </Text>
    </View>
  );
}

/**
 * Kurzprofil section: thick underline title + bullet list with hanging indent
 */
function Page1Kurzprofil({
  config,
  data,
}: SubProps) {
  const { highlights } = data;
  if (highlights.length === 0) return null;

  return (
    <View>
      <Text
        style={[
          styles.page1KurzprofilTitle,
          { borderBottomColor: config.global.primaryColor || colors.heading },
        ]}
      >
        Kurzprofil
      </Text>
      {highlights.map((h, i) => (
        <View key={i} style={styles.page1BulletRow}>
          <Text style={styles.page1BulletDot}>•</Text>
          <Text style={styles.page1BulletText}>{h}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Page 1 footer: "CV_Vorname_Nachname | dd.mm.yyyy | Kürzel" left,
 * page number right
 */
function Page1Footer({
  config,
  data,
}: SubProps) {
  const fileName = buildFileName(data.personal);
  const initials =
    (data.personal.firstName?.[0] ?? "") + (data.personal.lastName?.[0] ?? "");

  return (
    <View style={styles.page1Footer} fixed>
      <View style={styles.page1FooterLeft}>
        <Text style={styles.page1FooterText}>
          {fileName}  |  {todayFormatted()}  |  {initials}
        </Text>
      </View>
      <Text
        style={styles.page1FooterPage}
        render={({ pageNumber, totalPages }) =>
          `Seite ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGES 2+ Components – Iron Horse Two-Column Layout
// ─────────────────────────────────────────────────────────────────────────────

/** Logo + Company header bar (pages 2+) */
function CvHeader({ config }: { config: CvDesignConfig }) {
  const { header, global: g } = config;
  if (!header.showCompanyInfo) return null;

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={[styles.headerName, { color: g.primaryColor }]}>
          {header.companyName}
        </Text>
        {header.companySlogan ? (
          <Text style={styles.headerRole}>{header.companySlogan}</Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>
        {header.logoUrl ? (
          <Image
            src={header.logoUrl}
            style={[styles.headerLogo, { width: header.logoWidth }]}
          />
        ) : null}
      </View>
    </View>
  );
}

// ─── Sidebar Primitives ──────────────────────────────────────────────────────

/** Single label/value item in sidebar mini-table */
function SidebarItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={styles.sidebarItemRow}>
      <Text style={styles.sidebarItemLabel}>{label}</Text>
      <Text style={styles.sidebarItemValue}>{value}</Text>
    </View>
  );
}

/** Sidebar section title with thick underline */
function SidebarSectionTitle({
  title,
  config,
  marginTop,
}: {
  title: string;
  config: CvDesignConfig;
  marginTop?: number;
}) {
  return (
    <Text
      style={[
        styles.sidebarSectionTitle,
        {
          borderBottomColor: config.global.primaryColor || colors.heading,
          marginTop: marginTop ?? 0,
        },
      ]}
    >
      {title}
    </Text>
  );
}

// ─── Sidebar Content Block ───────────────────────────────────────────────────

/** Left sidebar: Persönliche Daten, Ausbildung, Sprachen, Zertifikate */
function SidebarContent({ config, data }: SubProps) {
  const { personal, education, languages, certificates } = data;

  return (
    <View style={styles.sidebarCol}>
      {/* ── Persönliche Daten ─────────────────────────────── */}
      <SidebarSectionTitle title="Persönliche Daten" config={config} />

      <SidebarItem label="Geboren am" value={personal.birthDate} />
      <SidebarItem label="Nationalität" value={personal.nationality} />
      <SidebarItem
        label="Wohnort"
        value={
          [personal.city, personal.canton].filter(Boolean).join(", ") || null
        }
      />
      <SidebarItem label="E-Mail" value={personal.email} />
      <SidebarItem label="Telefon" value={personal.phone} />

      {personal.linkedinUrl && (
        <View style={styles.sidebarItemRow}>
          <Text style={styles.sidebarItemLabel}>LinkedIn</Text>
          <Link
            src={personal.linkedinUrl}
            style={[
              styles.sidebarItemValue,
              {
                color: config.global.primaryColor,
                textDecoration: "none",
              },
            ]}
          >
            Profil ansehen
          </Link>
        </View>
      )}

      {/* ── Ausbildung ────────────────────────────────────── */}
      {education.length > 0 && (
        <>
          <SidebarSectionTitle
            title="Ausbildung"
            config={config}
            marginTop={16}
          />
          {education.map((ed, i) => {
            // Extract year(s) for the left column
            const yearStart = ed.startDate?.split("-")[0];
            const yearEnd = ed.endDate?.split("-")[0];
            const yearLabel = yearStart && yearEnd
              ? `${yearStart} – ${yearEnd}`
              : yearStart
                ? `seit ${yearStart}`
                : yearEnd ?? "";

            return (
              <View key={i} style={styles.sidebarEduRow}>
                <Text style={styles.sidebarEduYear}>{yearLabel}</Text>
                <View style={styles.sidebarEduDetail}>
                  <Text style={styles.sidebarEduDegree}>{ed.degree}</Text>
                  <Text style={styles.sidebarEduInstitution}>
                    {ed.institution}
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* ── Sprachen ──────────────────────────────────────── */}
      {languages.length > 0 && (
        <>
          <SidebarSectionTitle
            title="Sprachen"
            config={config}
            marginTop={16}
          />
          {languages.map((l, i) => (
            <View key={i} style={styles.sidebarLangRow}>
              <Text style={styles.sidebarLangName}>{l.language}</Text>
              <Text style={styles.sidebarLangLevel}>{l.level}</Text>
            </View>
          ))}
        </>
      )}

      {/* ── Zertifikate (Sidebar) ─────────────────────────── */}
      {certificates.length > 0 && (
        <>
          <SidebarSectionTitle
            title="Zertifikate"
            config={config}
            marginTop={16}
          />
          {certificates.map((cert, i) => {
            const yearLabel = cert.date?.split("-")[0] ?? "";
            return (
              <View key={i} style={styles.sidebarCertRow}>
                <Text style={styles.sidebarCertYear}>{yearLabel}</Text>
                <View style={styles.sidebarCertDetail}>
                  <Text style={styles.sidebarCertName}>{cert.name}</Text>
                  {cert.issuer && (
                    <Text style={styles.sidebarCertIssuer}>{cert.issuer}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

// ─── JobRow (single experience entry) ────────────────────────────────────────

/**
 * A single job entry rendered as a table row:
 *   Col 1 (80pt): Zeitraum (bold)
 *   Col 2 (flex): Company (bold) → Role → Description bullets → Tech
 *
 * wrap={false} prevents ugly mid-entry page breaks.
 */
function JobRow({
  entry,
  config,
}: {
  entry: CvExperienceEntry;
  config: CvDesignConfig;
}) {
  // Split description into bullet lines if it contains newlines
  const descriptionLines = entry.description
    ? entry.description.split("\n").filter((l) => l.trim())
    : [];
  const hasBullets = descriptionLines.length > 1;

  return (
    <View wrap={false} style={styles.jobRow}>
      {/* Col 1 – Zeitraum */}
      <View style={styles.jobDateCol}>
        <Text style={styles.jobDateText}>
          {dateRange(entry.startDate, entry.endDate)}
        </Text>
      </View>

      {/* Col 2 – Details */}
      <View style={styles.jobDetailCol}>
        <Text style={styles.jobCompany}>{entry.company}</Text>
        <Text style={styles.jobRole}>{entry.role}</Text>

        {hasBullets
          ? descriptionLines.map((line, i) => (
              <View key={i} style={styles.jobBulletRow}>
                <Text style={styles.jobBulletDot}>•</Text>
                <Text style={styles.jobBulletText}>{line.replace(/^[•\-–]\s*/, "")}</Text>
              </View>
            ))
          : entry.description && (
              <Text style={styles.jobDescription}>{entry.description}</Text>
            )}

        {entry.technologies && entry.technologies.length > 0 && (
          <Text style={styles.jobTech}>
            {entry.technologies.join(" · ")}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Column Section Title ───────────────────────────────────────────────

function MainSectionTitle({
  title,
  config,
  marginTop,
}: {
  title: string;
  config: CvDesignConfig;
  marginTop?: number;
}) {
  return (
    <Text
      style={[
        styles.mainSectionTitle,
        {
          borderBottomColor: config.global.primaryColor || colors.heading,
          marginTop: marginTop ?? 0,
        },
      ]}
    >
      {title}
    </Text>
  );
}

// ─── Main Content Block ──────────────────────────────────────────────────────

/**
 * Right column: Beruflicher Werdegang (projects) + Festanstellungen (permanent)
 * Splits experience[] by type and renders each group.
 */
function MainContent({ config, data }: SubProps) {
  // Separate by type – default to "project" if unset
  const projects = data.experience.filter((e) => (e.type ?? "project") === "project");
  const permanent = data.experience.filter((e) => e.type === "permanent");

  return (
    <View style={styles.mainCol}>
      {/* ── Beruflicher Werdegang (Projekte / Mandate) ───── */}
      {projects.length > 0 && (
        <>
          <MainSectionTitle title="Beruflicher Werdegang" config={config} />
          {projects.map((exp, i) => (
            <JobRow key={i} entry={exp} config={config} />
          ))}
        </>
      )}

      {/* ── Festanstellungen ──────────────────────────────── */}
      {permanent.length > 0 && (
        <>
          <MainSectionTitle
            title="Festanstellungen"
            config={config}
            marginTop={16}
          />
          {permanent.map((exp, i) => (
            <JobRow key={i} entry={exp} config={config} />
          ))}
        </>
      )}
    </View>
  );
}

// ─── TwoColumnLayout (composite) ─────────────────────────────────────────────

/**
 * Full two-column layout for pages 2+.
 * Sidebar (28%) | Main (72%) with a vertical divider.
 */
function TwoColumnLayout({ config, data }: SubProps) {
  return (
    <View style={styles.twoColRow}>
      <SidebarContent config={config} data={data} />
      <MainContent config={config} data={data} />
    </View>
  );
}

/** Skills / competencies list (standalone page) */
function SkillList({ config, data }: SubProps) {
  const { global: g } = config;

  if (data.skills.length === 0) return null;

  const cols = 3;
  const rows: string[][] = [];
  for (let i = 0; i < data.skills.length; i += cols) {
    rows.push(data.skills.slice(i, i + cols));
  }

  return (
    <View>
      <Text
        style={[
          styles.mainSectionTitle,
          { borderBottomColor: g.primaryColor || colors.heading },
        ]}
      >
        Kompetenzen
      </Text>

      {rows.map((row, ri) => (
        <View key={ri} style={styles.skillRow}>
          {row.map((skill, si) => (
            <View
              key={si}
              style={[styles.skillCell, { width: `${100 / cols}%` }]}
            >
              <View
                style={[styles.skillDot, { backgroundColor: g.primaryColor }]}
              />
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Fixed footer on every page (pages 2+) */
function CvFooter({ config, data }: SubProps) {
  const fileName = buildFileName(data.personal);
  const initials =
    (data.personal.firstName?.[0] ?? "") + (data.personal.lastName?.[0] ?? "");

  return (
    <View style={styles.page1Footer} fixed>
      <View style={styles.page1FooterLeft}>
        <Text style={styles.page1FooterText}>
          {fileName}  |  {todayFormatted()}  |  {initials}
        </Text>
      </View>
      <Text
        style={styles.page1FooterPage}
        render={({ pageNumber, totalPages }) =>
          `Seite ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Document
// ─────────────────────────────────────────────────────────────────────────────

interface CvPdfDocumentProps {
  data: CvContentData;
  config: CvDesignConfig;
}

export function CvPdfDocument({ data, config }: CvPdfDocumentProps) {
  const pageOverrides = {
    paddingHorizontal: config.layout.pageMargin,
    paddingTop: config.layout.pageMargin,
    paddingBottom: config.layout.pageMargin + 20,
  } as const;

  return (
    <Document
      title={`CV – ${data.personal.firstName} ${data.personal.lastName}`}
      author={config.header.companyName}
    >
      {/* ── Page 1: Iron Horse Cover ─────────────────────── */}
      <Page size="A4" style={[styles.page, pageOverrides]}>
        <Page1Header config={config} />
        <Page1Photo config={config} data={data} />
        <Page1NameBlock data={data} />
        <Page1Kurzprofil config={config} data={data} />
        <Page1Footer config={config} data={data} />
      </Page>

      {/* ── Page 2+: Two-Column Detail ────────────────────── */}
      <Page size="A4" style={[styles.page, pageOverrides]} wrap>
        <CvHeader config={config} />
        <TwoColumnLayout config={config} data={data} />
        <CvFooter config={config} data={data} />
      </Page>

      {/* ── Skills Page ───────────────────────────────────── */}
      {data.skills.length > 0 && (
        <Page size="A4" style={[styles.page, pageOverrides]}>
          <CvHeader config={config} />
          <SkillList config={config} data={data} />
          <CvFooter config={config} data={data} />
        </Page>
      )}
    </Document>
  );
}

export default CvPdfDocument;
