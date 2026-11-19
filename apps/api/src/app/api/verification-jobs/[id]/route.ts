import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.verificationJob.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Verification job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      documentId: job.documentId,
      state: job.state,
      currentStage: job.currentStage,
      currentStep: job.currentStep,
      totalSteps: job.totalSteps,
      tavilyBudgetUsed: job.tavilyBudgetUsed,
      tavilyBudgetMax: job.tavilyBudgetMax,
      steps: job.steps,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve job status' }, { status: 500 });
  }
}
