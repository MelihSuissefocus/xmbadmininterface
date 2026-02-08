"use client";

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  Font,
} from "@react-pdf/renderer";
import type {
  CvDesignConfig,
  CvContentData,
  CvExperienceEntry,
} from "@/lib/cv-generator/schema";

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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

interface SubProps {
  config: CvDesignConfig;
  data: CvContentData;
}

/** Logo + Company header bar */
function CvHeader({ config }: { config: CvDesignConfig }) {
  const { header, global } = config;
  if (!header.showCompanyInfo) return null;

  const justify =
    header.logoPosition === "right"
      ? "flex-end"
      : header.logoPosition === "center"
        ? "center"
        : "flex-start";

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: justify,
        alignItems: "center",
        marginBottom: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: global.primaryColor,
      }}
    >
      {header.logoUrl ? (
        <Image
          src={header.logoUrl}
          style={{ width: header.logoWidth, objectFit: "contain" }}
        />
      ) : (
        <View>
          <Text
            style={{
              fontSize: config.typography.headingSize + 4,
              fontFamily: global.fontFamily,
              color: global.primaryColor,
              fontWeight: "bold",
            }}
          >
            {header.companyName}
          </Text>
          {header.companySlogan ? (
            <Text
              style={{
                fontSize: config.typography.bodySize,
                fontFamily: global.fontFamily,
                color: "#666666",
              }}
            >
              {header.companySlogan}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Cover page: photo, name, highlights */
function CvCoverPage({ config, data }: SubProps) {
  const { global, typography, sections } = config;
  const { personal, highlights } = data;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {/* Photo */}
      {sections.showPhoto && personal.photoUrl && (
        <Image
          src={personal.photoUrl}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            marginBottom: 16,
            objectFit: "cover",
          }}
        />
      )}

      {/* Name */}
      <Text
        style={{
          fontSize: typography.headingSize + 10,
          fontFamily: global.fontFamily,
          color: global.primaryColor,
          fontWeight: "bold",
          marginBottom: 4,
        }}
      >
        {personal.firstName} {personal.lastName}
      </Text>

      {/* Target role */}
      {personal.targetRole && (
        <Text
          style={{
            fontSize: typography.headingSize,
            fontFamily: global.fontFamily,
            color: "#555555",
            marginBottom: 24,
          }}
        >
          {personal.targetRole}
        </Text>
      )}

      {/* Kurzprofil */}
      {highlights.length > 0 && (
        <View
          style={{
            width: "80%",
            padding: 16,
            backgroundColor: "#f7f7f7",
            borderLeftWidth: 3,
            borderLeftColor: global.primaryColor,
          }}
        >
          <Text
            style={{
              fontSize: typography.headingSize,
              fontFamily: global.fontFamily,
              color: global.primaryColor,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Kurzprofil
          </Text>
          {highlights.map((h, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", marginBottom: 4, paddingRight: 8 }}
            >
              <Text
                style={{
                  fontSize: typography.bodySize,
                  fontFamily: global.fontFamily,
                  color: global.primaryColor,
                  marginRight: 6,
                }}
              >
                •
              </Text>
              <Text
                style={{
                  fontSize: typography.bodySize,
                  fontFamily: global.fontFamily,
                  lineHeight: global.lineHeight,
                  flex: 1,
                }}
              >
                {h}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Left sidebar: personal data, languages, education */
function CvSidebar({ config, data }: SubProps) {
  const { global, typography, layout } = config;
  const { personal, languages, education } = data;

  const labelStyle = {
    fontSize: typography.bodySize - 1,
    fontFamily: global.fontFamily,
    color: "#888888",
    marginBottom: 1,
  } as const;

  const valueStyle = {
    fontSize: typography.bodySize,
    fontFamily: global.fontFamily,
    marginBottom: 8,
    lineHeight: global.lineHeight,
  } as const;

  const sectionHeading = {
    fontSize: typography.headingSize - 2,
    fontFamily: global.fontFamily,
    color: global.primaryColor,
    fontWeight: "bold" as const,
    marginBottom: 8,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: global.primaryColor,
    paddingBottom: 3,
  };

  const entries: { label: string; value: string | null | undefined }[] = [
    { label: "Geburtsdatum", value: personal.birthDate },
    { label: "Nationalität", value: personal.nationality },
    { label: "Wohnort", value: [personal.city, personal.canton].filter(Boolean).join(", ") || null },
    { label: "E-Mail", value: personal.email },
    { label: "Telefon", value: personal.phone },
  ];

  return (
    <View
      style={{
        width: `${layout.sidebarWidth}%`,
        paddingRight: 14,
        borderRightWidth: 1,
        borderRightColor: "#e0e0e0",
      }}
    >
      {/* Persönliche Daten */}
      <Text style={sectionHeading}>Persönliche Daten</Text>
      {entries.map(
        (e, i) =>
          e.value && (
            <View key={i}>
              <Text style={labelStyle}>{e.label}</Text>
              <Text style={valueStyle}>{e.value}</Text>
            </View>
          )
      )}

      {personal.linkedinUrl && (
        <View>
          <Text style={labelStyle}>LinkedIn</Text>
          <Link
            src={personal.linkedinUrl}
            style={{ ...valueStyle, color: global.primaryColor, textDecoration: "none" }}
          >
            Profil ansehen
          </Link>
        </View>
      )}

      {/* Sprachen */}
      {languages.length > 0 && (
        <>
          <Text style={sectionHeading}>Sprachen</Text>
          {languages.map((l, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={{ ...valueStyle, marginBottom: 0 }}>
                {l.language}
              </Text>
              <Text
                style={{
                  ...valueStyle,
                  marginBottom: 0,
                  color: "#666666",
                }}
              >
                {l.level}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Ausbildung */}
      {education.length > 0 && (
        <>
          <Text style={sectionHeading}>Ausbildung</Text>
          {education.map((ed, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={{ ...valueStyle, fontWeight: "bold", marginBottom: 2 }}>
                {ed.degree}
              </Text>
              <Text style={{ ...valueStyle, color: "#555555", marginBottom: 1 }}>
                {ed.institution}
              </Text>
              {(ed.startDate || ed.endDate) && (
                <Text style={{ ...labelStyle }}>
                  {dateRange(ed.startDate, ed.endDate)}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

/** Single experience row in table layout */
function ExperienceRow({
  entry,
  config,
}: {
  entry: CvExperienceEntry;
  config: CvDesignConfig;
}) {
  const { global, typography } = config;

  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: "#e8e8e8",
      }}
    >
      {/* Date column */}
      <View style={{ width: "22%", paddingRight: 8 }}>
        <Text
          style={{
            fontSize: typography.bodySize - 1,
            fontFamily: global.fontFamily,
            color: "#666666",
            lineHeight: global.lineHeight,
          }}
        >
          {dateRange(entry.startDate, entry.endDate)}
        </Text>
      </View>

      {/* Details column */}
      <View style={{ width: "78%" }}>
        <Text
          style={{
            fontSize: typography.bodySize,
            fontFamily: global.fontFamily,
            fontWeight: "bold",
            marginBottom: 2,
          }}
        >
          {entry.role}
        </Text>
        <Text
          style={{
            fontSize: typography.bodySize,
            fontFamily: global.fontFamily,
            color: global.primaryColor,
            marginBottom: 4,
          }}
        >
          {entry.company}
        </Text>
        {entry.description && (
          <Text
            style={{
              fontSize: typography.bodySize - 1,
              fontFamily: global.fontFamily,
              color: "#444444",
              lineHeight: global.lineHeight,
              marginBottom: 4,
            }}
          >
            {entry.description}
          </Text>
        )}
        {entry.technologies && entry.technologies.length > 0 && (
          <Text
            style={{
              fontSize: typography.bodySize - 1,
              fontFamily: global.fontFamily,
              color: "#777777",
            }}
          >
            {entry.technologies.join(" · ")}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Experience section in table form */
function ExperienceTable({ config, data }: SubProps) {
  const { global, typography } = config;

  if (data.experience.length === 0) return null;

  return (
    <View>
      <Text
        style={{
          fontSize: typography.headingSize,
          fontFamily: global.fontFamily,
          color: global.primaryColor,
          fontWeight: "bold",
          marginBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: global.primaryColor,
          paddingBottom: 4,
        }}
      >
        Beruflicher Werdegang
      </Text>

      {/* Table header */}
      <View
        style={{
          flexDirection: "row",
          marginBottom: 6,
          paddingBottom: 4,
          borderBottomWidth: 0.5,
          borderBottomColor: "#cccccc",
        }}
      >
        <Text
          style={{
            width: "22%",
            fontSize: typography.bodySize - 1,
            fontFamily: global.fontFamily,
            color: "#999999",
            fontWeight: "bold",
          }}
        >
          Zeitraum
        </Text>
        <Text
          style={{
            width: "78%",
            fontSize: typography.bodySize - 1,
            fontFamily: global.fontFamily,
            color: "#999999",
            fontWeight: "bold",
          }}
        >
          Position / Unternehmen
        </Text>
      </View>

      {data.experience.map((exp, i) => (
        <ExperienceRow key={i} entry={exp} config={config} />
      ))}
    </View>
  );
}

/** Skills / competencies list */
function SkillList({ config, data }: SubProps) {
  const { global, typography } = config;

  if (data.skills.length === 0) return null;

  // Render skills as compact pill-like rows, 3 per row
  const cols = 3;
  const rows: string[][] = [];
  for (let i = 0; i < data.skills.length; i += cols) {
    rows.push(data.skills.slice(i, i + cols));
  }

  return (
    <View>
      <Text
        style={{
          fontSize: typography.headingSize,
          fontFamily: global.fontFamily,
          color: global.primaryColor,
          fontWeight: "bold",
          marginBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: global.primaryColor,
          paddingBottom: 4,
        }}
      >
        Kompetenzen
      </Text>

      {rows.map((row, ri) => (
        <View
          key={ri}
          style={{
            flexDirection: "row",
            marginBottom: 6,
          }}
        >
          {row.map((skill, si) => (
            <View
              key={si}
              style={{
                width: `${100 / cols}%`,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: global.primaryColor,
                  marginRight: 6,
                }}
              />
              <Text
                style={{
                  fontSize: typography.bodySize,
                  fontFamily: global.fontFamily,
                  lineHeight: global.lineHeight,
                }}
              >
                {skill}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Certificates */
function CertificateList({ config, data }: SubProps) {
  const { global, typography } = config;

  if (data.certificates.length === 0) return null;

  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          fontSize: typography.headingSize,
          fontFamily: global.fontFamily,
          color: global.primaryColor,
          fontWeight: "bold",
          marginBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: global.primaryColor,
          paddingBottom: 4,
        }}
      >
        Zertifikate
      </Text>

      {data.certificates.map((cert, i) => (
        <View
          key={i}
          wrap={false}
          style={{ flexDirection: "row", marginBottom: 6 }}
        >
          <Text
            style={{
              width: "22%",
              fontSize: typography.bodySize - 1,
              fontFamily: global.fontFamily,
              color: "#666666",
            }}
          >
            {cert.date ?? ""}
          </Text>
          <View style={{ width: "78%" }}>
            <Text
              style={{
                fontSize: typography.bodySize,
                fontFamily: global.fontFamily,
                fontWeight: "bold",
              }}
            >
              {cert.name}
            </Text>
            {cert.issuer && (
              <Text
                style={{
                  fontSize: typography.bodySize - 1,
                  fontFamily: global.fontFamily,
                  color: "#555555",
                }}
              >
                {cert.issuer}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Fixed footer on every page */
function CvFooter({ config }: { config: CvDesignConfig }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: config.layout.pageMargin,
        left: config.layout.pageMargin,
        right: config.layout.pageMargin,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopWidth: 0.5,
        borderTopColor: "#cccccc",
        paddingTop: 6,
      }}
      fixed
    >
      <Text
        style={{
          fontSize: 7,
          fontFamily: config.global.fontFamily,
          color: "#999999",
        }}
      >
        {config.header.companyName}
        {config.header.companySlogan ? ` – ${config.header.companySlogan}` : ""}
      </Text>
      <Text
        style={{
          fontSize: 7,
          fontFamily: config.global.fontFamily,
          color: "#999999",
        }}
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
  const pageStyle = {
    fontFamily: config.global.fontFamily,
    fontSize: config.global.baseFontSize,
    padding: config.layout.pageMargin,
    paddingBottom: config.layout.pageMargin + 20, // room for footer
    color: "#222222",
  } as const;

  return (
    <Document
      title={`CV – ${data.personal.firstName} ${data.personal.lastName}`}
      author={config.header.companyName}
    >
      {/* ── Page 1: Cover ─────────────────────────────────── */}
      <Page size="A4" style={pageStyle}>
        <CvHeader config={config} />
        <CvCoverPage config={config} data={data} />
        <CvFooter config={config} />
      </Page>

      {/* ── Page 2+: Two-column detail ────────────────────── */}
      <Page size="A4" style={pageStyle} wrap>
        <CvHeader config={config} />

        <View style={{ flexDirection: "row", flex: 1 }}>
          {/* Sidebar */}
          <CvSidebar config={config} data={data} />

          {/* Main content */}
          <View
            style={{
              width: `${100 - config.layout.sidebarWidth}%`,
              paddingLeft: 14,
            }}
          >
            <ExperienceTable config={config} data={data} />
            <CertificateList config={config} data={data} />
          </View>
        </View>

        <CvFooter config={config} />
      </Page>

      {/* ── Page 3: Skills ────────────────────────────────── */}
      {data.skills.length > 0 && (
        <Page size="A4" style={pageStyle}>
          <CvHeader config={config} />
          <SkillList config={config} data={data} />
          <CvFooter config={config} />
        </Page>
      )}
    </Document>
  );
}

export default CvPdfDocument;
