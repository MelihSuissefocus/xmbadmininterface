/**
 * CV Auto-Fill Validation Schemas
 * Zod runtime validation for file uploads and extraction results
 */

import { z } from "zod";

// File upload validation
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: "Datei ist zu groß. Maximum: 10 MB",
    })
    .refine(
      (file) => {
        const allowedTypes = [
          "application/pdf",
          "image/png",
          "image/jpg",
          "image/jpeg",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        return allowedTypes.includes(file.type);
      },
      {
        message: "Nur PDF, PNG, JPG oder DOCX erlaubt",
      }
    ),
});

// Confidence level
const confidenceLevelSchema = z.enum(["high", "medium", "low"]);

// Source info
const sourceInfoSchema = z.object({
  text: z.string(),
  page: z.number().int().min(1).optional(),
  position: z.string().optional(),
});

// Suggested target
const suggestedTargetSchema = z.object({
  targetField: z.string(),
  confidence: confidenceLevelSchema,
  reason: z.string(),
});

// Filled field
const filledFieldSchema = z.object({
  targetField: z.string(),
  extractedValue: z.unknown(),
  confidence: confidenceLevelSchema,
  source: sourceInfoSchema,
});

// Ambiguous field
const ambiguousFieldSchema = z.object({
  extractedLabel: z.string(),
  extractedValue: z.string(),
  suggestedTargets: z.array(suggestedTargetSchema).min(1),
  selectedTarget: z.string().nullable().optional(),
  source: sourceInfoSchema,
});

// Unmapped item
const unmappedItemSchema = z.object({
  extractedLabel: z.string().nullable().optional(),
  extractedValue: z.string(),
  category: z
    .enum(["contact", "date", "text", "skill", "language", "education", "experience", "other"])
    .optional(),
  suggestedTargets: z.array(suggestedTargetSchema),
  selectedTarget: z.string().nullable().optional(),
  source: sourceInfoSchema,
});

// Extraction metadata
const extractionMetadataSchema = z.object({
  fileName: z.string(),
  fileType: z.enum(["pdf", "png", "jpg", "jpeg", "docx"]),
  fileSize: z.number().int().min(0),
  pageCount: z.number().int().min(1).optional(),
  extractionMethod: z.enum(["text", "ocr"]),
  processingTimeMs: z.number().int().min(0),
  timestamp: z.string().datetime(),
});

// Complete extraction result / mapping report
export const extractionResultSchema = z.object({
  filledFields: z.array(filledFieldSchema),
  ambiguousFields: z.array(ambiguousFieldSchema),
  unmappedItems: z.array(unmappedItemSchema),
  metadata: extractionMetadataSchema,
});

// User mapping schema (for when user modifies mappings)
export const userMappingSchema = z.object({
  fieldId: z.string(),
  selectedTarget: z.string().nullable(),
});

// Language entry
const languageEntrySchema = z.object({
  language: z.string(),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "Muttersprache"]),
});

// Certificate entry
const certificateEntrySchema = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.string(),
});

// Education entry
const educationEntrySchema = z.object({
  degree: z.string(),
  institution: z.string(),
  startMonth: z.string().regex(/^(0[1-9]|1[0-2])$/).optional(),
  startYear: z.string().regex(/^[0-9]{4}$/).optional(),
  endMonth: z.string().regex(/^(0[1-9]|1[0-2])$/).optional(),
  endYear: z.string().regex(/^[0-9]{4}$/).optional(),
});

// Experience entry
const experienceEntrySchema = z.object({
  role: z.string(),
  company: z.string(),
  startMonth: z.string().regex(/^(0[1-9]|1[0-2])$/).optional(),
  startYear: z.string().regex(/^[0-9]{4}$/).optional(),
  endMonth: z.string().regex(/^(0[1-9]|1[0-2])$/).optional(),
  endYear: z.string().regex(/^[0-9]{4}$/).optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
});

// Candidate form data validation
export const candidateFormDataSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  canton: z.string().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional().or(z.literal("")),
  targetRole: z.string().nullable().optional(),
  yearsOfExperience: z.number().int().min(0).nullable().optional(),
  currentSalary: z.number().int().min(0).nullable().optional(),
  expectedSalary: z.number().int().min(0).nullable().optional(),
  desiredHourlyRate: z.number().int().min(0).nullable().optional(),
  isSubcontractor: z.boolean().optional(),
  companyName: z.string().nullable().optional(),
  companyType: z.enum(["ag", "gmbh", "einzelunternehmen"]).nullable().optional(),
  workloadPreference: z.string().nullable().optional(),
  noticePeriod: z.string().nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["new", "reviewed", "rejected", "placed"]).optional(),
  skills: z.array(z.string()).optional(),
  languages: z.array(languageEntrySchema).optional(),
  certificates: z.array(certificateEntrySchema).optional(),
  education: z.array(educationEntrySchema).optional(),
  experience: z.array(experienceEntrySchema).optional(),
  highlights: z.array(z.string()).max(4).optional(),
});
