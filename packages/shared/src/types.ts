/**
 * Shared TypeScript types derived from Zod schemas.
 * Re-exported from schemas.ts via index.ts.
 *
 * This file holds supplementary interfaces not directly
 * represented by a single Zod schema (composite types, etc.).
 */

import type {
  SupportVerdict,
  VerificationState,
  SourceAccessState,
  RetractionStatus,
  CorrectionStatus,
  CurrentnessAssessment,
  ConfidenceLevel,
  HumanReviewStatus,
  ReferenceResolutionState,
} from './schemas.js';

/** Composite claim verification result — all independent dimensions */
export interface ClaimVerificationResult {
  claimId: string;
  referenceResolutionState: ReferenceResolutionState;
  supportVerdict: SupportVerdict | null;
  sourceAccessState: SourceAccessState;
  retractionStatus: RetractionStatus;
  correctionStatus: CorrectionStatus;
  currentnessAssessment: CurrentnessAssessment;
  verificationState: VerificationState;
  humanReviewStatus: HumanReviewStatus;
  confidence: ConfidenceLevel | null;
  confidenceBasis: string | null;
}
