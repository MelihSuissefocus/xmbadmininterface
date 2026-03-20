import "server-only";

import { AzureOpenAI } from "openai";
import type { Candidate } from "@/db/schema";

// ── Azure OpenAI client (reuse project config) ──────────────────────────────

function getAzureClient(): AzureOpenAI | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  if (!endpoint || !apiKey || !deployment) return null;

  return new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
}

// ── Types matching the docxtemplater template ────────────────────────────────

interface ProjektErfolg {
  erfolg_text: string;
}
interface ProjektHerausforderung {
  herausforderung_text: string;
}
interface ProjektLearning {
  learning_text: string;
}

interface Projekt {
  projekt_start: string;
  projekt_ende: string;
  projekt_kunde: string;
  projekt_ort: string;
  projekt_titel: string;
  projekt_rolle: string;
  projekt_kurzbeschrieb: string;
  projekt_tools: string;
  projekt_methoden: string;
  erfolge: ProjektErfolg[];
  herausforderungen: ProjektHerausforderung[];
  learnings: ProjektLearning[];
}

export interface DocxTemplateData {
  vorname: string;
  nachname: string;
  nationalitaet: string;
  zielfunktion: string;
  branchenerfahrung: string;
  sprachen: { sprache_name: string; sprache_niveau: string }[];
  kompetenzen: { kompetenz_kategorie: string; kompetenz_details: string }[];
  ausbildungen: { ausbildung_titel: string }[];
  zertifikate: { zertifikat_name: string }[];
  projekte: Projekt[];
}

// ── LLM prompt to extract structured project info from description ───────────

const PROJECT_EXTRACTION_SYSTEM = `Du bist ein Experte für Lebenslauf-Analyse. Du erhältst eine Projektbeschreibung eines Kandidaten und extrahierst daraus strukturierte Informationen.

Antworte ausschliesslich mit validem JSON im folgenden Format:
{
  "kurzbeschrieb": "1-2 Sätze Zusammenfassung des Projekts",
  "tools": "Kommagetrennte Liste der verwendeten Tools/Technologien",
  "methoden": "Kommagetrennte Liste der angewandten Methoden",
  "erfolge": ["Erfolg 1", "Erfolg 2"],
  "herausforderungen": ["Herausforderung 1"],
  "learnings": ["Learning 1"],
  "ort": "Ort falls erkennbar, sonst leer"
}

Regeln:
- Wenn keine Informationen zu einem Feld erkennbar sind, verwende einen leeren String oder ein leeres Array.
- Erfinde keine Informationen. Extrahiere nur was im Text enthalten ist.
- Halte die Texte kurz und prägnant.`;

interface LlmProjectResult {
  kurzbeschrieb: string;
  tools: string;
  methoden: string;
  erfolge: string[];
  herausforderungen: string[];
  learnings: string[];
  ort: string;
}

async function extractProjectDetailsWithLLM(
  client: AzureOpenAI,
  deployment: string,
  description: string
): Promise<LlmProjectResult> {
  const fallback: LlmProjectResult = {
    kurzbeschrieb: description.slice(0, 200),
    tools: "",
    methoden: "",
    erfolge: [],
    herausforderungen: [],
    learnings: [],
    ort: "",
  };

  if (!description || description.trim().length < 10) {
    return fallback;
  }

  try {
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: PROJECT_EXTRACTION_SYSTEM },
        { role: "user", content: description },
      ],
      temperature: 0,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as Partial<LlmProjectResult>;
    return {
      kurzbeschrieb: parsed.kurzbeschrieb || fallback.kurzbeschrieb,
      tools: parsed.tools || "",
      methoden: parsed.methoden || "",
      erfolge: Array.isArray(parsed.erfolge) ? parsed.erfolge : [],
      herausforderungen: Array.isArray(parsed.herausforderungen) ? parsed.herausforderungen : [],
      learnings: Array.isArray(parsed.learnings) ? parsed.learnings : [],
      ort: parsed.ort || "",
    };
  } catch (err) {
    console.error("LLM project extraction failed, using fallback:", err);
    return fallback;
  }
}

// ── Main mapping function ────────────────────────────────────────────────────

export async function mapCandidateToDocxData(candidate: Candidate): Promise<DocxTemplateData> {
  const languages = (candidate.languages as { language: string; level: string }[] | null) ?? [];
  const skillsArr = (candidate.skills as { category: string; details: string }[] | null) ?? [];
  const educationArr = (candidate.education as { degree: string; institution: string }[] | null) ?? [];
  const certificatesArr = (candidate.certificates as { name: string }[] | null) ?? [];
  const experienceArr = (candidate.experience as {
    role: string;
    company: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
    current: boolean;
    description: string;
  }[] | null) ?? [];

  // ── Build projekte with LLM extraction ──
  const client = getAzureClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "";

  const projekte: Projekt[] = [];

  for (const exp of experienceArr) {
    let llmResult: LlmProjectResult;

    if (client && deployment && exp.description) {
      llmResult = await extractProjectDetailsWithLLM(client, deployment, exp.description);
    } else {
      llmResult = {
        kurzbeschrieb: exp.description?.slice(0, 200) || "",
        tools: "",
        methoden: "",
        erfolge: [],
        herausforderungen: [],
        learnings: [],
        ort: "",
      };
    }

    const formatDate = (month: string, year: string) => {
      if (!month && !year) return "";
      if (!month) return year;
      return `${month}.${year}`;
    };

    projekte.push({
      projekt_start: formatDate(exp.startMonth, exp.startYear),
      projekt_ende: exp.current ? "heute" : formatDate(exp.endMonth, exp.endYear),
      projekt_kunde: exp.company || "",
      projekt_ort: llmResult.ort,
      projekt_titel: exp.role || "",
      projekt_rolle: exp.role || "",
      projekt_kurzbeschrieb: llmResult.kurzbeschrieb,
      projekt_tools: llmResult.tools,
      projekt_methoden: llmResult.methoden,
      erfolge: llmResult.erfolge.map((t) => ({ erfolg_text: t })),
      herausforderungen: llmResult.herausforderungen.map((t) => ({ herausforderung_text: t })),
      learnings: llmResult.learnings.map((t) => ({ learning_text: t })),
    });
  }

  return {
    vorname: candidate.firstName,
    nachname: candidate.lastName,
    nationalitaet: candidate.nationality || "",
    zielfunktion: candidate.targetRole || "",
    branchenerfahrung: candidate.industryExperience || "",
    sprachen: languages.map((l) => ({
      sprache_name: l.language,
      sprache_niveau: l.level,
    })),
    kompetenzen: skillsArr.map((s) => ({
      kompetenz_kategorie: s.category,
      kompetenz_details: s.details,
    })),
    ausbildungen: educationArr.map((e) => ({
      ausbildung_titel: [e.degree, e.institution].filter(Boolean).join(", "),
    })),
    zertifikate: certificatesArr.map((c) => ({
      zertifikat_name: c.name,
    })),
    projekte,
  };
}
