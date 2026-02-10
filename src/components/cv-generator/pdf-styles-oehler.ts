import { Font, StyleSheet } from "@react-pdf/renderer";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Font Registration – Inter (Light 300, Regular 400, SemiBold 600, Bold 700)
//    Modern Sans-Serif für das Stefan-Oehler-Template
// ─────────────────────────────────────────────────────────────────────────────

const INTER_BASE =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin";

Font.register({
  family: "Inter",
  fonts: [
    {
      src: `${INTER_BASE}-300-normal.ttf`,
      fontWeight: 300,
      fontStyle: "normal",
    },
    {
      src: `${INTER_BASE}-400-normal.ttf`,
      fontWeight: 400,
      fontStyle: "normal",
    },
    {
      src: `${INTER_BASE}-600-normal.ttf`,
      fontWeight: 600,
      fontStyle: "normal",
    },
    {
      src: `${INTER_BASE}-700-normal.ttf`,
      fontWeight: 700,
      fontStyle: "normal",
    },
    {
      src: `${INTER_BASE}-400-italic.ttf`,
      fontWeight: 400,
      fontStyle: "italic",
    },
  ],
});

// Hyphenation deaktivieren – sauberer bei kurzen Zellen / Spalten
Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Farbpalette – Stefan Oehler Style
// ─────────────────────────────────────────────────────────────────────────────

export const oehlerColors = {
  /** Fast-Schwarz für Fließtext */
  body: "#333333",
  /** Dunkelgrau für Überschriften */
  heading: "#2D2D2D",
  /** Trennlinie unter Überschriften */
  rule: "#CCCCCC",
  /** Dezentes Grau für Labels / sekundären Text */
  muted: "#888888",
  /** Leichter Hintergrund-Akzent */
  lightBg: "#F7F7F7",
  /** Page-Hintergrund */
  pageBg: "#FFFFFF",
  /** Akzentfarbe (subtiles Blau für Links / Highlights) */
  accent: "#2B6CB0",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Maße – A4 mit 20mm Seitenrändern
//    20mm ≈ 56.7pt (1mm = 2.835pt)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_MARGIN = 57; // ~20mm in pt

// ─────────────────────────────────────────────────────────────────────────────
// 4. StyleSheet – Stefan Oehler Template
// ─────────────────────────────────────────────────────────────────────────────

export const oehlerStyles = StyleSheet.create({
  /* ── Page ──────────────────────────────────────────────── */
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    lineHeight: 1.45,
    color: oehlerColors.body,
    backgroundColor: oehlerColors.pageBg,
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN + 20, // Extra space for fixed footer
    paddingHorizontal: PAGE_MARGIN,
  },

  /* ── Header – Logo links, Firmendaten rechts ───────────── */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: oehlerColors.rule,
  },
  headerLogoBlock: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "40%",
  },
  headerLogo: {
    width: 120,
    height: "auto",
    objectFit: "contain" as const,
  },
  headerLogoPlaceholder: {
    width: 80,
    height: 40,
    backgroundColor: oehlerColors.lightBg,
    borderWidth: 1,
    borderColor: oehlerColors.rule,
    justifyContent: "center",
    alignItems: "center",
  },
  headerLogoPlaceholderText: {
    fontSize: 7,
    color: oehlerColors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerCompanyBlock: {
    alignItems: "flex-end",
    maxWidth: "55%",
  },
  headerCompanyName: {
    fontSize: 13,
    fontWeight: 700,
    color: oehlerColors.heading,
    marginBottom: 2,
    textAlign: "right",
  },
  headerCompanyService: {
    fontSize: 9,
    fontWeight: 400,
    color: oehlerColors.muted,
    textAlign: "right",
    marginBottom: 1,
  },
  headerCompanyUrl: {
    fontSize: 8,
    fontWeight: 400,
    color: oehlerColors.accent,
    textAlign: "right",
    textDecoration: "none",
  },

  /* ── Candidate Title Bar ───────────────────────────────── */
  candidateTitleBar: {
    marginBottom: 20,
  },
  candidateName: {
    fontSize: 22,
    fontWeight: 700,
    color: oehlerColors.heading,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  candidateRole: {
    fontSize: 11,
    fontWeight: 400,
    color: oehlerColors.muted,
    letterSpacing: 0.2,
  },

  /* ── Section Title (h2) ────────────────────────────────── */
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: oehlerColors.heading,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: oehlerColors.rule,
    marginBottom: 10,
    marginTop: 16,
  },

  /* ── Two-Column Table (25% / 75%) – borderless ─────────── */
  tableRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingBottom: 6,
  },
  tableRowWithSeparator: {
    flexDirection: "row",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E8E8E8",
  },
  tableDateCol: {
    width: "25%",
    paddingRight: 10,
  },
  tableDetailCol: {
    width: "75%",
  },
  tableDateText: {
    fontSize: 9,
    fontWeight: 600,
    color: oehlerColors.heading,
    lineHeight: 1.5,
  },
  tableCategoryText: {
    fontSize: 9,
    fontWeight: 600,
    color: oehlerColors.heading,
    lineHeight: 1.5,
  },

  /* ── Detail Text Styles ────────────────────────────────── */
  detailTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: oehlerColors.heading,
    marginBottom: 2,
  },
  detailSubtitle: {
    fontSize: 10,
    fontWeight: 400,
    color: oehlerColors.body,
    marginBottom: 3,
  },
  detailDescription: {
    fontSize: 9,
    fontWeight: 300,
    color: oehlerColors.body,
    lineHeight: 1.55,
    marginBottom: 3,
  },
  detailTech: {
    fontSize: 8,
    fontWeight: 400,
    color: oehlerColors.muted,
    fontStyle: "italic",
    marginTop: 2,
  },

  /* ── Bullet Points ─────────────────────────────────────── */
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 2,
  },
  bulletDot: {
    width: 14,
    fontSize: 10,
    fontWeight: 700,
    color: oehlerColors.heading,
    lineHeight: 1.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    fontWeight: 400,
    color: oehlerColors.body,
    lineHeight: 1.55,
  },

  /* ── Kurzprofil / Summary-Box ────────────────────────────── */
  summaryBox: {
    marginBottom: 18,
    padding: 12,
    backgroundColor: oehlerColors.lightBg,
    borderLeftWidth: 3,
    borderLeftColor: oehlerColors.accent,
  },
  summaryBulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 2,
  },
  summaryBulletDot: {
    width: 14,
    fontSize: 10,
    fontWeight: 700,
    color: oehlerColors.heading,
    lineHeight: 1.55,
  },
  summaryBulletText: {
    flex: 1,
    fontSize: 9,
    fontWeight: 400,
    color: oehlerColors.body,
    lineHeight: 1.55,
  },
  summaryBoldCategory: {
    fontWeight: 700,
    color: oehlerColors.heading,
  },

  /* ── Personal Data – Compact Table ─────────────────────── */
  personalCompactTable: {
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: oehlerColors.rule,
  },
  personalCompactRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: oehlerColors.rule,
  },
  personalCompactRowLast: {
    flexDirection: "row",
  },
  personalCompactLabel: {
    width: "25%",
    fontSize: 9,
    fontWeight: 600,
    color: oehlerColors.heading,
    backgroundColor: oehlerColors.lightBg,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  personalCompactValue: {
    width: "75%",
    fontSize: 9,
    fontWeight: 400,
    color: oehlerColors.body,
    paddingVertical: 5,
    paddingHorizontal: 8,
    lineHeight: 1.45,
  },

  /* ── Werdegang – Grouped Employer ──────────────────────── */
  employerGroupHeader: {
    flexDirection: "row",
    marginBottom: 2,
    marginTop: 6,
  },
  employerGroupDateCol: {
    width: "25%",
    paddingRight: 10,
  },
  employerGroupDateText: {
    fontSize: 9,
    fontWeight: 600,
    color: oehlerColors.heading,
    lineHeight: 1.5,
  },
  employerGroupDetailCol: {
    width: "75%",
  },
  employerGroupName: {
    fontSize: 10.5,
    fontWeight: 700,
    color: oehlerColors.heading,
    marginBottom: 4,
  },
  roleEntry: {
    marginBottom: 8,
    paddingLeft: 0,
  },
  roleFunktionText: {
    fontSize: 9.5,
    fontWeight: 400,
    fontStyle: "italic",
    color: oehlerColors.body,
    marginBottom: 3,
  },
  roleFunktionPrefix: {
    fontWeight: 600,
    fontStyle: "normal",
    color: oehlerColors.heading,
  },
  roleSubDateText: {
    fontSize: 8,
    fontWeight: 300,
    color: oehlerColors.muted,
    marginBottom: 3,
  },
  employerGroupSeparator: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#E8E8E8",
    marginBottom: 10,
    paddingBottom: 6,
  },

  /* ── Skills Grid ───────────────────────────────────────── */
  skillRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  skillCell: {
    flexDirection: "row",
    alignItems: "center",
  },
  skillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 6,
  },
  skillText: {
    fontSize: 9,
    fontWeight: 400,
    color: oehlerColors.body,
  },

  /* ── Language Row ──────────────────────────────────────── */
  langRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  langLabel: {
    width: "25%",
    fontSize: 9,
    fontWeight: 600,
    color: oehlerColors.heading,
  },
  langValue: {
    width: "75%",
    fontSize: 9,
    fontWeight: 400,
    color: oehlerColors.body,
  },

  /* ── Certificate Row ───────────────────────────────────── */
  certRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  certDateCol: {
    width: "25%",
    paddingRight: 10,
  },
  certDateText: {
    fontSize: 9,
    fontWeight: 600,
    color: oehlerColors.heading,
  },
  certDetailCol: {
    width: "75%",
  },
  certName: {
    fontSize: 10,
    fontWeight: 600,
    color: oehlerColors.heading,
    marginBottom: 1,
  },
  certIssuer: {
    fontSize: 9,
    fontWeight: 300,
    color: oehlerColors.muted,
  },

  /* ── Photo Block ───────────────────────────────────────── */
  photoRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  photo: {
    width: 100,
    height: 130,
    objectFit: "cover" as const,
    marginRight: 20,
  },
  photoPlaceholder: {
    width: 100,
    height: 130,
    backgroundColor: oehlerColors.lightBg,
    borderWidth: 1,
    borderColor: oehlerColors.rule,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 20,
  },
  photoPlaceholderText: {
    fontSize: 8,
    color: oehlerColors.muted,
  },

  /* ── Footer (fixed, jede Seite) ────────────────────────── */
  footer: {
    position: "absolute",
    bottom: PAGE_MARGIN - 10,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    borderTopWidth: 0.75,
    borderTopColor: oehlerColors.rule,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    fontWeight: 300,
    color: oehlerColors.muted,
  },
  footerPageNumber: {
    fontSize: 7,
    fontWeight: 400,
    color: oehlerColors.muted,
    textAlign: "right",
  },
});
