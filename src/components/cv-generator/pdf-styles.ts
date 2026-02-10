import { Font, StyleSheet } from "@react-pdf/renderer";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Font Registration – Open Sans (Light 300, Regular 400, Bold 700)
//    Google Fonts CDN liefert TTF direkt aus.
// ─────────────────────────────────────────────────────────────────────────────

// fontsource CDN – reliable, CORS-enabled, serves raw .ttf files
const OPEN_SANS_BASE =
  "https://cdn.jsdelivr.net/fontsource/fonts/open-sans@latest/latin";

Font.register({
  family: "OpenSans",
  fonts: [
    {
      src: `${OPEN_SANS_BASE}-300-normal.ttf`,
      fontWeight: 300,
      fontStyle: "normal",
    },
    {
      src: `${OPEN_SANS_BASE}-400-normal.ttf`,
      fontWeight: 400,
      fontStyle: "normal",
    },
    {
      src: `${OPEN_SANS_BASE}-700-normal.ttf`,
      fontWeight: 700,
      fontStyle: "normal",
    },
    {
      src: `${OPEN_SANS_BASE}-400-italic.ttf`,
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: `${OPEN_SANS_BASE}-700-italic.ttf`,
      fontWeight: 700,
      fontStyle: "italic",
    },
  ],
});

// Hyphenation deaktivieren – sauberer bei kurzen Zellen / Spalten
Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Farbpalette
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  /** Fast-Schwarz für Fließtext */
  body: "#232323",
  /** Reines Schwarz für Namen, Titel, Section-Lines */
  heading: "#000000",
  /** Helles Grau für dezente Trennlinien */
  rule: "#E0E0E0",
  /** Dunkleres Grau für Labels / sekundären Text */
  muted: "#777777",
  /** Sidebar-Hintergrund (weiß, aber als Token definiert) */
  sidebarBg: "#FFFFFF",
  /** Page-Hintergrund */
  pageBg: "#FFFFFF",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. StyleSheet
// ─────────────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  /* ── Page ──────────────────────────────────────────────── */
  page: {
    fontFamily: "OpenSans",
    fontSize: 10,
    lineHeight: 1.4,
    color: colors.body,
    backgroundColor: colors.pageBg,
    paddingTop: 35,
    paddingBottom: 35,
    paddingHorizontal: 35,
  },

  /* ── Header ────────────────────────────────────────────── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "column",
    maxWidth: "55%",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerName: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.heading,
    marginBottom: 2,
  },
  headerRole: {
    fontSize: 12,
    fontWeight: 300,
    color: colors.muted,
  },
  headerLogo: {
    objectFit: "contain" as const,
  },

  /* ── Footer (fixed, jede Seite) ────────────────────────── */
  footer: {
    position: "absolute",
    bottom: 30,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: colors.heading,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    fontWeight: 300,
    color: colors.muted,
  },
  footerPageNumber: {
    fontSize: 8,
    fontWeight: 400,
    color: colors.muted,
    textAlign: "right",
  },

  /* ── Section Title ─────────────────────────────────────── */
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.heading,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.heading,
  },

  /* ── Two-Column Layout (Seite 2+) ──────────────────────── */
  twoColumn: {
    flexDirection: "row",
    flex: 1,
  },
  sidebar: {
    paddingRight: 16,
    borderRightWidth: 0.5,
    borderRightColor: colors.rule,
  },
  mainArea: {
    paddingLeft: 16,
  },

  /* ── Sidebar: Label / Value pairs ──────────────────────── */
  sidebarLabel: {
    fontSize: 8,
    fontWeight: 400,
    color: colors.muted,
    marginBottom: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sidebarValue: {
    fontSize: 10,
    fontWeight: 400,
    color: colors.body,
    marginBottom: 8,
    lineHeight: 1.4,
  },

  /* ── Experience Table Row ──────────────────────────────── */
  experienceRow: {
    flexDirection: "row",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.rule,
  },
  experienceDateCol: {
    width: "22%",
    paddingRight: 8,
  },
  experienceDate: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.muted,
    lineHeight: 1.4,
  },
  experienceDetailCol: {
    width: "78%",
  },
  experienceRole: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.heading,
    marginBottom: 2,
  },
  experienceCompany: {
    fontSize: 10,
    fontWeight: 400,
    color: colors.body,
    marginBottom: 4,
  },
  experienceDescription: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.body,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  experienceTech: {
    fontSize: 8,
    fontWeight: 400,
    color: colors.muted,
    fontStyle: "italic",
  },

  /* ── Bullet Points (Kurzprofil etc.) ───────────────────── */
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 14,
    fontSize: 10,
    fontWeight: 700,
    color: colors.heading,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    fontWeight: 400,
    color: colors.body,
    lineHeight: 1.5,
  },

  /* ── Skills Grid ───────────────────────────────────────── */
  skillRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  skillCell: {
    flexDirection: "row",
    alignItems: "center",
  },
  skillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.heading,
    marginRight: 6,
  },
  skillText: {
    fontSize: 10,
    fontWeight: 400,
    color: colors.body,
  },

  /* ── Language Row ──────────────────────────────────────── */
  languageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  languageName: {
    fontSize: 10,
    fontWeight: 400,
    color: colors.body,
  },
  languageLevel: {
    fontSize: 10,
    fontWeight: 300,
    color: colors.muted,
  },

  /* ── Education Block ───────────────────────────────────── */
  educationBlock: {
    marginBottom: 10,
  },
  educationDegree: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.heading,
    marginBottom: 1,
  },
  educationInstitution: {
    fontSize: 9,
    fontWeight: 400,
    color: colors.body,
    marginBottom: 1,
  },
  educationDate: {
    fontSize: 8,
    fontWeight: 300,
    color: colors.muted,
  },

  /* ── Certificate Row ───────────────────────────────────── */
  certRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  certDateCol: {
    width: "22%",
  },
  certDate: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.muted,
  },
  certDetailCol: {
    width: "78%",
  },
  certName: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.heading,
  },
  certIssuer: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.muted,
  },

  /* ── Cover Page ────────────────────────────────────────── */
  coverCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    objectFit: "cover" as const,
  },
  coverName: {
    fontSize: 26,
    fontWeight: 700,
    color: colors.heading,
    marginBottom: 4,
  },
  coverRole: {
    fontSize: 14,
    fontWeight: 300,
    color: colors.muted,
    marginBottom: 28,
  },
  coverHighlightBox: {
    width: "80%",
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.heading,
    backgroundColor: "#F8F8F8",
  },
  coverHighlightTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.heading,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  /* ── Page 1: Iron Horse Layout ─────────────────────────── */

  /** Top-right logo + company address block */
  page1TopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  page1LogoBlock: {
    alignItems: "flex-end",
  },
  page1Logo: {
    width: 130,
    height: "auto",
    objectFit: "contain" as const,
    marginBottom: 6,
  },
  page1CompanyAddress: {
    fontSize: 7.5,
    fontWeight: 300,
    color: colors.muted,
    textAlign: "right",
    lineHeight: 1.5,
  },

  /** Candidate photo – large, left-aligned */
  page1PhotoRow: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 16,
  },
  page1Photo: {
    width: 150,
    height: 190,
    objectFit: "cover" as const,
  },
  page1PhotoPlaceholder: {
    width: 150,
    height: 190,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  page1PhotoPlaceholderText: {
    fontSize: 9,
    color: colors.muted,
  },

  /** Name + Dossier title bar */
  page1NameBar: {
    marginBottom: 20,
  },
  page1Name: {
    fontSize: 24,
    fontWeight: 700,
    color: colors.heading,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  page1DossierTitle: {
    fontSize: 12,
    fontWeight: 300,
    color: colors.muted,
    letterSpacing: 0.3,
  },

  /** Kurzprofil section on Page 1 */
  page1KurzprofilTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.heading,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingBottom: 5,
    borderBottomWidth: 2.5,
    borderBottomColor: colors.heading,
    marginBottom: 10,
  },
  page1BulletRow: {
    flexDirection: "row",
    marginBottom: 5,
    paddingLeft: 2,
  },
  page1BulletDot: {
    width: 16,
    fontSize: 10,
    fontWeight: 700,
    color: colors.heading,
    lineHeight: 1.5,
  },
  page1BulletText: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: 400,
    color: colors.body,
    lineHeight: 1.55,
  },

  /** Page 1 footer: filename + date left, page number right */
  page1Footer: {
    position: "absolute",
    bottom: 25,
    left: 35,
    right: 35,
    borderTopWidth: 0.75,
    borderTopColor: colors.heading,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  page1FooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  page1FooterText: {
    fontSize: 7,
    fontWeight: 300,
    color: colors.muted,
  },
  page1FooterPage: {
    fontSize: 7,
    fontWeight: 400,
    color: colors.muted,
    textAlign: "right",
  },

  /* ── Page 2+: Two-Column Layout (Iron Horse) ───────────── */

  /** Outer row container that holds sidebar + main */
  twoColRow: {
    flexDirection: "row",
    flex: 1,
  },

  /** Left sidebar column (28%) */
  sidebarCol: {
    width: "28%",
    paddingRight: 14,
  },

  /** Right main column (68% + 4% gap) */
  mainCol: {
    width: "72%",
    paddingLeft: 14,
    borderLeftWidth: 0.75,
    borderLeftColor: colors.rule,
  },

  /** Section title used in sidebar (smaller, tighter) */
  sidebarSectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.heading,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.heading,
    marginBottom: 8,
    marginTop: 0,
  },

  /** Section title used in main column */
  mainSectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.heading,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.heading,
    marginBottom: 10,
    marginTop: 0,
  },

  /* ── SidebarItem: label/value pair as mini-table ────────── */
  sidebarItemRow: {
    marginBottom: 6,
  },
  sidebarItemLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: colors.heading,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  sidebarItemValue: {
    fontSize: 9,
    fontWeight: 400,
    color: colors.body,
    lineHeight: 1.45,
  },

  /* ── Sidebar Education: year left, degree right ─────────── */
  sidebarEduRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  sidebarEduYear: {
    width: 50,
    fontSize: 9,
    fontWeight: 700,
    color: colors.heading,
    lineHeight: 1.4,
  },
  sidebarEduDetail: {
    flex: 1,
  },
  sidebarEduDegree: {
    fontSize: 9,
    fontWeight: 400,
    color: colors.body,
    lineHeight: 1.4,
    marginBottom: 1,
  },
  sidebarEduInstitution: {
    fontSize: 8,
    fontWeight: 300,
    color: colors.muted,
    lineHeight: 1.3,
  },

  /* ── Sidebar Language Row ──────────────────────────────── */
  sidebarLangRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sidebarLangName: {
    fontSize: 9,
    fontWeight: 400,
    color: colors.body,
  },
  sidebarLangLevel: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.muted,
  },

  /* ── Sidebar Certificate Row ───────────────────────────── */
  sidebarCertRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  sidebarCertYear: {
    width: 50,
    fontSize: 9,
    fontWeight: 700,
    color: colors.heading,
    lineHeight: 1.4,
  },
  sidebarCertDetail: {
    flex: 1,
  },
  sidebarCertName: {
    fontSize: 9,
    fontWeight: 400,
    color: colors.body,
    lineHeight: 1.4,
    marginBottom: 1,
  },
  sidebarCertIssuer: {
    fontSize: 8,
    fontWeight: 300,
    color: colors.muted,
    lineHeight: 1.3,
  },

  /* ── JobRow: single experience entry (table-style) ─────── */
  jobRow: {
    flexDirection: "row",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.rule,
  },
  jobDateCol: {
    width: 80,
    paddingRight: 8,
  },
  jobDateText: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.heading,
    lineHeight: 1.4,
  },
  jobDetailCol: {
    flex: 1,
  },
  jobCompany: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.heading,
    marginBottom: 2,
  },
  jobRole: {
    fontSize: 9.5,
    fontWeight: 400,
    color: colors.body,
    marginBottom: 3,
  },
  jobDescription: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.body,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  jobBulletRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 2,
  },
  jobBulletDot: {
    width: 12,
    fontSize: 9,
    fontWeight: 700,
    color: colors.heading,
    lineHeight: 1.5,
  },
  jobBulletText: {
    flex: 1,
    fontSize: 9,
    fontWeight: 300,
    color: colors.body,
    lineHeight: 1.5,
  },
  jobTech: {
    fontSize: 8,
    fontWeight: 400,
    color: colors.muted,
    fontStyle: "italic",
    marginTop: 2,
  },
});
