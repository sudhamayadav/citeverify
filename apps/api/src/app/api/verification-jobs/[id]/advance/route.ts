import { NextRequest, NextResponse } from 'next/server';
import { advanceVerificationJob } from '@/lib/jobOrchestrator';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await advanceVerificationJob(id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to advance verification job', detail: err.message },
      { status: 500 }
    );
  }
}
