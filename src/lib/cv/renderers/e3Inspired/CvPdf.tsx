import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CVData } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Font setup – built-in Helvetica only, no external files needed
// ─────────────────────────────────────────────────────────────────────────────

Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────────────────────────────────────────────────────────
// Colour tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  black: "#1A1A1A",
  dark: "#333333",
  mid: "#666666",
  muted: "#999999",
  rule: "#D0D0D0",
  light: "#F5F5F5",
  white: "#FFFFFF",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Page ──────────────────────────────────────────────────
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.45,
    color: C.dark,
    backgroundColor: C.white,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
  },

  // ── Header ────────────────────────────────────────────────
  headerWrap: {
    marginBottom: 24,
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    letterSpacing: 0.3,
  },
  targetRole: {
    fontSize: 13,
    color: C.mid,
    marginTop: 2,
  },
  contactLine: {
    fontSize: 9,
    color: C.muted,
    marginTop: 6,
  },
  headerRule: {
    borderBottomWidth: 0.75,
    borderBottomColor: C.rule,
    marginTop: 14,
  },

  // ── Two-column area (Languages + Skills) ──────────────────
  twoCols: {
    flexDirection: "row" as const,
    marginBottom: 20,
  },
  colLeft: {
    width: "38%",
    paddingRight: 16,
  },
  colRight: {
    width: "62%",
    paddingLeft: 16,
    borderLeftWidth: 0.5,
    borderLeftColor: C.rule,
  },

  // ── Section heading ───────────────────────────────────────
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: C.black,
    marginBottom: 8,
  },

  // ── Language row ──────────────────────────────────────────
  langRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: 3,
  },
  langName: {
    fontSize: 10,
    color: C.dark,
  },
  langLevel: {
    fontSize: 10,
    color: C.muted,
  },

  // ── Skills (comma-separated tags) ─────────────────────────
  skillText: {
    fontSize: 10,
    color: C.dark,
    lineHeight: 1.55,
  },

  // ── Bullet list (highlights) ──────────────────────────────
  bulletRow: {
    flexDirection: "row" as const,
    marginBottom: 4,
  },
  bulletDot: {
    width: 14,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.black,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: C.dark,
    lineHeight: 1.5,
  },

  // ── Education / Certificate rows ──────────────────────────
  eduRow: {
    flexDirection: "row" as const,
    marginBottom: 6,
  },
  eduPeriod: {
    width: 90,
    fontSize: 9,
    color: C.muted,
    paddingRight: 8,
  },
  eduDetail: {
    flex: 1,
  },
  eduTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
  },
  eduInstitution: {
    fontSize: 9,
    color: C.mid,
  },
  certRow: {
    marginBottom: 5,
  },
  certName: {
    fontSize: 10,
    color: C.dark,
  },
  certMeta: {
    fontSize: 9,
    color: C.muted,
  },

  // ── Experience entry ──────────────────────────────────────
  expEntry: {
    flexDirection: "row" as const,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  expPeriodCol: {
    width: 90,
    paddingRight: 8,
  },
  expPeriod: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
    lineHeight: 1.4,
  },
  expDetailCol: {
    flex: 1,
  },
  expTitleRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: 4,
  },
  expTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    flex: 1,
    paddingRight: 8,
  },
  expIdNo: {
    fontSize: 8,
    color: C.muted,
  },
  expBulletRow: {
    flexDirection: "row" as const,
    marginBottom: 3,
    paddingLeft: 2,
  },
  expBulletDot: {
    width: 12,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
    lineHeight: 1.5,
  },
  expBulletText: {
    flex: 1,
    fontSize: 9,
    color: C.dark,
    lineHeight: 1.5,
  },

  // ── Footer ────────────────────────────────────────────────
  footer: {
    position: "absolute" as const,
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
  },
  footerPage: {
    fontSize: 8,
    color: C.muted,
  },

  // ── Spacing helpers ───────────────────────────────────────
  sectionGap: {
    marginBottom: 18,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Header({ data }: { data: CVData }) {
  const { personal, variant } = data;
  const parts: string[] = [];
  if (variant === "internal") {
    if (personal.email) parts.push(personal.email);
    if (personal.phone) parts.push(personal.phone);
    if (personal.city) parts.push(personal.city);
  }

  return (
    <View style={s.headerWrap}>
      <Text style={s.name}>
        {personal.firstName} {personal.lastName}
      </Text>
      {personal.targetRole ? (
        <Text style={s.targetRole}>{personal.targetRole}</Text>
      ) : null}
      {parts.length > 0 ? (
        <Text style={s.contactLine}>{parts.join("  ·  ")}</Text>
      ) : null}
      <View style={s.headerRule} />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function LanguagesSection({ data }: { data: CVData }) {
  if (data.languages.length === 0) return null;
  return (
    <View>
      <SectionTitle title="Sprachen" />
      {data.languages.map((l, i) => (
        <View key={i} style={s.langRow}>
          <Text style={s.langName}>{l.language}</Text>
          <Text style={s.langLevel}>{l.level}</Text>
        </View>
      ))}
    </View>
  );
}

function SkillsSection({ data }: { data: CVData }) {
  if (data.skills.length === 0) return null;
  return (
    <View>
      <SectionTitle title="Kompetenzen" />
      <Text style={s.skillText}>{data.skills.map(s => `${s.category}: ${s.details}`).join(",  ")}</Text>
    </View>
  );
}

function HighlightsSection({ data }: { data: CVData }) {
  if (data.highlights.length === 0) return null;
  return (
    <View style={s.sectionGap} wrap={false}>
      <SectionTitle title="Highlights" />
      {data.highlights.map((h, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{h}</Text>
        </View>
      ))}
    </View>
  );
}

function EducationSection({ data }: { data: CVData }) {
  if (data.education.length === 0) return null;
  return (
    <View style={s.sectionGap} wrap={false}>
      <SectionTitle title="Ausbildung" />
      {data.education.map((ed, i) => (
        <View key={i} style={s.eduRow}>
          <Text style={s.eduPeriod}>{ed.periodLabel}</Text>
          <View style={s.eduDetail}>
            <Text style={s.eduTitle}>{ed.title}</Text>
            <Text style={s.eduInstitution}>{ed.institution}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function CertificatesSection({ data }: { data: CVData }) {
  if (data.certificates.length === 0) return null;
  return (
    <View style={s.sectionGap} wrap={false}>
      <SectionTitle title="Zertifikate" />
      {data.certificates.map((cert, i) => {
        const meta = [cert.issuer, cert.date].filter(Boolean).join(", ");
        return (
          <View key={i} style={s.certRow}>
            <Text style={s.certName}>{cert.name}</Text>
            {meta ? <Text style={s.certMeta}>{meta}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function ExperienceSection({ data }: { data: CVData }) {
  if (data.experience.length === 0) return null;
  return (
    <View>
      <SectionTitle title="Relevante Arbeitserfahrung" />
      {data.experience.map((exp, i) => (
        <View key={i} style={s.expEntry} wrap={false}>
          {/* Left column – period */}
          <View style={s.expPeriodCol}>
            <Text style={s.expPeriod}>{exp.periodLabel}</Text>
          </View>

          {/* Right column – title + bullets */}
          <View style={s.expDetailCol}>
            <View style={s.expTitleRow}>
              <Text style={s.expTitle}>{exp.titleLine}</Text>
              {exp.idNo ? <Text style={s.expIdNo}>{exp.idNo}</Text> : null}
            </View>
            {exp.descriptionLines.map((line, j) => (
              <View key={j} style={s.expBulletRow}>
                <Text style={s.expBulletDot}>•</Text>
                <Text style={s.expBulletText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text
        style={s.footerPage}
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

export interface CvPdfProps {
  data: CVData;
}

/**
 * e3Inspired CV PDF document.
 *
 * Layout:
 *  Page 1  – Header, 2-column (Languages | Skills), Highlights, Education, Certificates
 *  Page 2+ – Relevante Arbeitserfahrung (auto-paginates)
 */
export function CvPdf({ data }: CvPdfProps) {
  const hasLanguagesOrSkills =
    data.languages.length > 0 || data.skills.length > 0;

  return (
    <Document
      title={`CV – ${data.personal.firstName} ${data.personal.lastName}`}
    >
      {/* ── Page 1: Profile overview ─────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Header data={data} />

        {/* Two-column: Languages | Skills */}
        {hasLanguagesOrSkills && (
          <View style={[s.twoCols, s.sectionGap]}>
            <View style={s.colLeft}>
              <LanguagesSection data={data} />
            </View>
            <View style={s.colRight}>
              <SkillsSection data={data} />
            </View>
          </View>
        )}

        <HighlightsSection data={data} />
        <EducationSection data={data} />
        <CertificatesSection data={data} />

        <PageFooter />
      </Page>

      {/* ── Page 2+: Experience (new page, auto-wraps) ───────── */}
      {data.experience.length > 0 && (
        <Page size="A4" style={s.page} wrap>
          <ExperienceSection data={data} />
          <PageFooter />
        </Page>
      )}
    </Document>
  );
}

export default CvPdf;
