import { NextRequest, NextResponse } from 'next/server';
import { getCleanAuditReport } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const report = await getCleanAuditReport(runId);

    if (!report) {
      return NextResponse.json({ error: 'Verification run not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve reproducibility audit report', detail: err.message },
      { status: 500 }
    );
  }
}
