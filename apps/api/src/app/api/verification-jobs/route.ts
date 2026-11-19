import { NextRequest, NextResponse } from 'next/server';
import { createVerificationJob } from '@/lib/jobOrchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { documentId, tavilyBudgetMax } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const job = await createVerificationJob(documentId, tavilyBudgetMax);
    return NextResponse.json({
      jobId: job.id,
      documentId: job.documentId,
      state: job.state,
      currentStage: job.currentStage,
      currentStep: job.currentStep,
      totalSteps: job.totalSteps,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to create verification job', detail: err.message }, { status: 500 });
  }
}
