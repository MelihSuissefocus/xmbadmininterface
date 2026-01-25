"use server";

import { db } from "@/db";
import { tenantFieldSynonyms, tenantSkillAliases, skills, cvExtractionFeedback } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export async function getFieldSynonyms(
  tenantId: string = DEFAULT_TENANT_ID
): Promise<Map<string, string>> {
  const synonyms = await db
    .select()
    .from(tenantFieldSynonyms)
    .where(eq(tenantFieldSynonyms.tenantId, tenantId));

  const map = new Map<string, string>();
  for (const s of synonyms) {
    map.set(s.sourceLabel.toLowerCase(), s.targetField);
  }
  return map;
}

export async function getSkillAliases(
  tenantId: string = DEFAULT_TENANT_ID
): Promise<Map<string, string>> {
  const aliases = await db
    .select({
      alias: tenantSkillAliases.alias,
      skillName: skills.name,
    })
    .from(tenantSkillAliases)
    .innerJoin(skills, eq(tenantSkillAliases.skillId, skills.id))
    .where(eq(tenantSkillAliases.tenantId, tenantId));

  const map = new Map<string, string>();
  for (const a of aliases) {
    map.set(a.alias.toLowerCase(), a.skillName);
  }
  return map;
}

export async function getAllSkillNames(): Promise<string[]> {
  const allSkills = await db.select({ name: skills.name }).from(skills);
  return allSkills.map((s) => s.name);
}

interface ActionResult {
  success: boolean;
  message: string;
}

export async function addFieldSynonym(
  sourceLabel: string,
  targetField: string,
  locale: string = "de"
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Nicht autorisiert" };
  }

  await db.insert(tenantFieldSynonyms).values({
    tenantId: DEFAULT_TENANT_ID,
    sourceLabel: sourceLabel.toLowerCase().trim(),
    targetField,
    locale,
    createdBy: session.user.id,
  });

  revalidatePath("/dashboard/candidates");
  return { success: true, message: "Synonym gespeichert" };
}

export async function addSkillAlias(
  alias: string,
  skillName: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Nicht autorisiert" };
  }

  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.name, skillName))
    .limit(1);

  if (!skill) {
    return { success: false, message: "Skill nicht gefunden" };
  }

  await db.insert(tenantSkillAliases).values({
    tenantId: DEFAULT_TENANT_ID,
    alias: alias.toLowerCase().trim(),
    skillId: skill.id,
    createdBy: session.user.id,
  });

  revalidatePath("/dashboard/candidates");
  return { success: true, message: "Alias gespeichert" };
}

export async function recordExtractionFeedback(
  jobId: string | null,
  targetField: string,
  extractedValue: string | null,
  userValue: string | null,
  action: "confirm" | "edit" | "reject",
  originalConfidence: number
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Nicht autorisiert" };
  }

  await db.insert(cvExtractionFeedback).values({
    jobId,
    targetField,
    extractedValue,
    userValue,
    action,
    originalConfidence: Math.round(originalConfidence * 100),
    createdBy: session.user.id,
  });

  return { success: true, message: "Feedback gespeichert" };
}

export async function getExtractionConfigForJob(): Promise<{
  synonyms: Record<string, string>;
  skillAliases: Record<string, string>;
  dbSkills: string[];
}> {
  const [synonymMap, aliasMap, skillList] = await Promise.all([
    getFieldSynonyms(),
    getSkillAliases(),
    getAllSkillNames(),
  ]);

  return {
    synonyms: Object.fromEntries(synonymMap),
    skillAliases: Object.fromEntries(aliasMap),
    dbSkills: skillList,
  };
}

