import { z } from 'zod';

// ─── Health ────────────────────────────────────────────────────────────
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string().datetime(),
  version: z.string(),
  database: z.enum(['connected', 'disconnected', 'error']),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ─── Demo Session ──────────────────────────────────────────────────────
export const DemoRoleSchema = z.enum(['Researcher', 'Faculty Reviewer']);
export type DemoRole = z.infer<typeof DemoRoleSchema>;

export const DemoSessionSchema = z.object({
  role: DemoRoleSchema,
  label: z.string(),
  disclaimer: z.string(),
});

export type DemoSession = z.infer<typeof DemoSessionSchema>;

// ─── Verification Verdicts ─────────────────────────────────────────────
export const SupportVerdictSchema = z.enum([
  'SUPPORTED',
  'PARTLY_SUPPORTED',
  'CONTRADICTORY',
  'UNSUPPORTED',
  'POTENTIALLY_OUTDATED',
]);
export type SupportVerdict = z.infer<typeof SupportVerdictSchema>;

// ─── Verification States ───────────────────────────────────────────────
export const VerificationStateSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'ABSTAINED',
  'ANALYSIS_FAILED',
  'API_ERROR',
  'CANCELLED',
  'NEEDS_HUMAN_REVIEW',
]);
export type VerificationState = z.infer<typeof VerificationStateSchema>;

// ─── Source Access States ──────────────────────────────────────────────
export const SourceAccessStateSchema = z.enum([
  'FULL_TEXT_RETRIEVED',
  'PARTIAL_TEXT',
  'ABSTRACT_ONLY',
  'SEARCH_SNIPPET_ONLY',
  'SOURCE_UNAVAILABLE',
  'EXTRACTION_FAILED',
  'UNKNOWN',
]);
export type SourceAccessState = z.infer<typeof SourceAccessStateSchema>;

// ─── Retraction States ─────────────────────────────────────────────────
export const RetractionStatusSchema = z.enum([
  'CONFIRMED_RETRACTED',
  'NOTICE_NOT_FOUND',
  'UNKNOWN',
]);
export type RetractionStatus = z.infer<typeof RetractionStatusSchema>;

// ─── Correction States ─────────────────────────────────────────────────
export const CorrectionStatusSchema = z.enum([
  'CORRECTION_FOUND',
  'NO_CORRECTION_NOTICE_FOUND',
  'UNKNOWN',
]);
export type CorrectionStatus = z.infer<typeof CorrectionStatusSchema>;

// ─── Currentness Assessment ────────────────────────────────────────────
export const CurrentnessAssessmentSchema = z.enum([
  'NO_CURRENTNESS_CONCERN_FOUND',
  'POSSIBLY_SUPERSEDED',
  'UNKNOWN',
]);
export type CurrentnessAssessment = z.infer<typeof CurrentnessAssessmentSchema>;

// ─── Reference Resolution States ───────────────────────────────────────
export const ReferenceResolutionStateSchema = z.enum([
  'MATCHED',
  'MISMATCHED',
  'UNRESOLVED',
  'AMBIGUOUS',
  'MISSING',
]);
export type ReferenceResolutionState = z.infer<typeof ReferenceResolutionStateSchema>;

// ─── Extraction States ─────────────────────────────────────────────────
export const ExtractionStateSchema = z.enum([
  'SUCCESS',
  'PARTIAL',
  'PARTIAL_OCR',
  'FAILED',
  'UNSUPPORTED_FORMAT',
  'PASSWORD_PROTECTED',
  'LIMIT_EXCEEDED',
  'OCR_UNAVAILABLE',
]);
export type ExtractionState = z.infer<typeof ExtractionStateSchema>;

// ─── Citation Mapping States ───────────────────────────────────────────
export const CitationMappingStateSchema = z.enum([
  'MATCHED',
  'AMBIGUOUS',
  'MISSING',
  'UNUSED_REFERENCE',
  'UNCITED_CLAIM',
  'POTENTIAL_UNCITED_CLAIM',
]);
export type CitationMappingState = z.infer<typeof CitationMappingStateSchema>;

// ─── Confidence Levels ─────────────────────────────────────────────────
export const ConfidenceLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

// ─── Human Review Status ───────────────────────────────────────────────
export const HumanReviewStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'OVERRIDDEN',
  'REJECTED',
]);
export type HumanReviewStatus = z.infer<typeof HumanReviewStatusSchema>;
