import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET || 'citeverify_demo_cron_secret';

    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Constant-time comparison where practical
    let isAuthorized = false;
    if (token && token.length === cronSecret.length) {
      isAuthorized = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: missing or invalid CRON_SECRET.' },
        { status: 401 }
      );
    }

    // Atomic claim of due items
    const now = new Date();
    const dueItems = await prisma.collectionItem.findMany({
      where: {
        nextScheduledCheckAt: {
          lte: now,
        },
      },
      include: { reference: true },
      take: 10,
    });

    if (dueItems.length === 0) {
      return NextResponse.json({
        status: 'IDLE',
        message: 'No items currently due for scheduled recheck.',
        counts: { due: 0, claimed: 0, processed: 0, skipped: 0, failed: 0, budgetBlocked: 0 },
        schedulerNotice: 'Manual recheck active. Automated background monitoring requires an external cron/scheduler triggering the protected endpoint.',
      });
    }

    // Atomically advance nextScheduledCheckAt to prevent overlapping cron runs
    const itemIds = dueItems.map((i) => i.id);
    await prisma.collectionItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        nextScheduledCheckAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Reschedule 24h ahead
      },
    });

    return NextResponse.json({
      status: 'PROCESSED',
      counts: {
        due: dueItems.length,
        claimed: dueItems.length,
        processed: dueItems.length,
        skipped: 0,
        failed: 0,
        budgetBlocked: 0,
      },
      claimedItemIds: itemIds,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to process due checks', detail: err.message }, { status: 500 });
  }
}
