import crypto from 'crypto';
import { prisma } from './db';
import { applyAuditSecurityTriggers } from './auditTriggers';

export interface AuditSnapshotData {
  verificationRunId: string;
  documentSha256: string;
  verdictRuleVersion?: string;
  claimSnapshot: {
    claimId: string;
    originalSentence: string;
    normalizedClaim: string;
  }[];
  tavilyQueriesSnapshot: {
    query: string;
    endpoint: string;
    timestamp: string;
    requestId?: string;
  }[];
  retrievedUrlsSnapshot: string[];
  contentHashesSnapshot: {
    url: string;
    contentSha256: string;
    retrievedAt: string;
  }[];
  passageOffsetsSnapshot: {
    passageId: string;
    startOffset: number;
    endOffset: number;
    offsetUnit: 'UTF-16';
  }[];
  researchOutputsSnapshot: {
    requestId?: string;
    content: any;
  }[];
  localValidationSnapshot: {
    quoteVerified: boolean;
    numericComparability: string;
    urlProvenanceVerified: boolean;
    ruleChecks: string[];
  };
  resultSnapshot: {
    automatedVerdict: string;
    confidence: string;
    verificationState: string;
  };
}

/**
 * Computes deterministic SHA-256 over canonically ordered JSON object
 */
export function computeCanonicalSha256(data: any): string {
  const canonicalString = canonicalJsonStringify(data);
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Serializes object with deterministically sorted keys
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Creates and persists RunAuditSnapshot atomically
 */
export async function createRunAuditSnapshot(data: AuditSnapshotData) {
  await applyAuditSecurityTriggers();

  const ruleVersion = data.verdictRuleVersion || '1.0.0';

  // Compute canonical deterministic snapshot hash
  const canonicalPayload = {
    verificationRunId: data.verificationRunId,
    documentSha256: data.documentSha256,
    verdictRuleVersion: ruleVersion,
    claimSnapshot: data.claimSnapshot,
    tavilyQueriesSnapshot: data.tavilyQueriesSnapshot,
    retrievedUrlsSnapshot: data.retrievedUrlsSnapshot,
    contentHashesSnapshot: data.contentHashesSnapshot,
    passageOffsetsSnapshot: data.passageOffsetsSnapshot,
    researchOutputsSnapshot: data.researchOutputsSnapshot,
    localValidationSnapshot: data.localValidationSnapshot,
    resultSnapshot: data.resultSnapshot,
  };

  const snapshotSha256 = computeCanonicalSha256(canonicalPayload);

  return prisma.runAuditSnapshot.create({
    data: {
      verificationRunId: data.verificationRunId,
      documentSha256: data.documentSha256,
      verdictRuleVersion: ruleVersion,
      claimSnapshot: JSON.stringify(data.claimSnapshot),
      tavilyQueriesSnapshot: JSON.stringify(data.tavilyQueriesSnapshot),
      retrievedUrlsSnapshot: JSON.stringify(data.retrievedUrlsSnapshot),
      contentHashesSnapshot: JSON.stringify(data.contentHashesSnapshot),
      passageOffsetsSnapshot: JSON.stringify(data.passageOffsetsSnapshot),
      researchOutputsSnapshot: JSON.stringify(data.researchOutputsSnapshot),
      localValidationSnapshot: JSON.stringify(data.localValidationSnapshot),
      resultSnapshot: JSON.stringify(data.resultSnapshot),
      snapshotSha256,
    },
  });
}

/**
 * Appends a tamper-evident audit event with previousEventHash link
 */
export async function appendRunAuditEvent(
  verificationRunId: string,
  eventType: string,
  payload: any
) {
  await applyAuditSecurityTriggers();

  // Find latest event sequence
  const latestEvent = await prisma.runAuditEvent.findFirst({
    where: { verificationRunId },
    orderBy: { sequenceNumber: 'desc' },
  });

  const nextSeq = (latestEvent?.sequenceNumber ?? 0) + 1;
  const previousEventHash = latestEvent?.eventHash ?? null;

  const eventContent = {
    verificationRunId,
    sequenceNumber: nextSeq,
    eventType,
    payload,
    previousEventHash,
  };

  const eventHash = computeCanonicalSha256(eventContent);

  return prisma.runAuditEvent.create({
    data: {
      verificationRunId,
      sequenceNumber: nextSeq,
      eventType,
      payloadSnapshot: JSON.stringify(payload),
      previousEventHash,
      eventHash,
    },
  });
}

/**
 * Validates cryptographic integrity of the event hash chain
 */
export async function verifyRunAuditChain(verificationRunId: string): Promise<{
  isValid: boolean;
  eventCount: number;
  brokenAtSequence?: number;
  reason?: string;
}> {
  const events = await prisma.runAuditEvent.findMany({
    where: { verificationRunId },
    orderBy: { sequenceNumber: 'asc' },
  });

  if (events.length === 0) {
    return { isValid: true, eventCount: 0 };
  }

  let expectedPrevHash: string | null = null;

  for (const event of events) {
    if (event.previousEventHash !== expectedPrevHash) {
      return {
        isValid: false,
        eventCount: events.length,
        brokenAtSequence: event.sequenceNumber,
        reason: `Previous hash mismatch: expected ${expectedPrevHash}, found ${event.previousEventHash}`,
      };
    }

    const payload = JSON.parse(event.payloadSnapshot);
    const expectedHash = computeCanonicalSha256({
      verificationRunId: event.verificationRunId,
      sequenceNumber: event.sequenceNumber,
      eventType: event.eventType,
      payload,
      previousEventHash: expectedPrevHash,
    });

    if (event.eventHash !== expectedHash) {
      return {
        isValid: false,
        eventCount: events.length,
        brokenAtSequence: event.sequenceNumber,
        reason: `Event hash corrupted at sequence ${event.sequenceNumber}`,
      };
    }

    expectedPrevHash = event.eventHash;
  }

  return { isValid: true, eventCount: events.length };
}

/**
 * Retrieves clean, sanitized audit summary without exposing secrets or paths
 */
export async function getCleanAuditReport(runId: string) {
  const run = await prisma.verificationRun.findUnique({
    where: { id: runId },
    include: {
      auditSnapshot: true,
      auditEvents: {
        orderBy: { sequenceNumber: 'asc' },
      },
    },
  });

  if (!run) return null;

  const chainCheck = await verifyRunAuditChain(runId);

  // Human reviews linked to the document
  const reviews = await prisma.humanReview.findMany({
    where: { documentId: run.documentId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      reviewerRole: true,
      reviewerLabel: true,
      action: true,
      notes: true,
      resultingState: true,
      recordHash: true,
      createdAt: true,
    },
  });

  let snapshot: any = null;
  if (run.auditSnapshot) {
    snapshot = {
      id: run.auditSnapshot.id,
      documentSha256: run.auditSnapshot.documentSha256,
      verdictRuleVersion: run.auditSnapshot.verdictRuleVersion,
      claimSnapshot: JSON.parse(run.auditSnapshot.claimSnapshot),
      tavilyQueriesSnapshot: JSON.parse(run.auditSnapshot.tavilyQueriesSnapshot),
      retrievedUrlsSnapshot: JSON.parse(run.auditSnapshot.retrievedUrlsSnapshot),
      contentHashesSnapshot: JSON.parse(run.auditSnapshot.contentHashesSnapshot),
      passageOffsetsSnapshot: JSON.parse(run.auditSnapshot.passageOffsetsSnapshot),
      researchOutputsSnapshot: JSON.parse(run.auditSnapshot.researchOutputsSnapshot),
      localValidationSnapshot: JSON.parse(run.auditSnapshot.localValidationSnapshot),
      resultSnapshot: JSON.parse(run.auditSnapshot.resultSnapshot),
      snapshotSha256: run.auditSnapshot.snapshotSha256,
      createdAt: run.auditSnapshot.createdAt.toISOString(),
    };
  }

  return {
    verificationRunId: run.id,
    runNumber: run.runNumber,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    hashChainValid: chainCheck.isValid,
    chainAuditDetails: chainCheck,
    auditSnapshot: snapshot,
    auditEvents: run.auditEvents.map((e) => ({
      sequenceNumber: e.sequenceNumber,
      eventType: e.eventType,
      payload: JSON.parse(e.payloadSnapshot),
      eventHash: e.eventHash,
      createdAt: e.createdAt.toISOString(),
    })),
    humanReviews: reviews,
  };
}
