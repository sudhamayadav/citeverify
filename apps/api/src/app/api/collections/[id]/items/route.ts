import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const AddItemSchema = z.object({
  referenceId: z.string().min(1, 'referenceId is required'),
  documentId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = AddItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const collection = await prisma.researchCollection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const reference = await prisma.reference.findUnique({
      where: { id: parsed.data.referenceId },
    });
    if (!reference) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }

    // Idempotent duplicate check: return existing item
    const existing = await prisma.collectionItem.findUnique({
      where: {
        collectionId_referenceId: {
          collectionId,
          referenceId: parsed.data.referenceId,
        },
      },
      include: { reference: true },
    });

    if (existing) {
      return NextResponse.json({ success: true, item: existing, deduplicated: true });
    }

    const item = await prisma.collectionItem.create({
      data: {
        collectionId,
        referenceId: parsed.data.referenceId,
        documentId: parsed.data.documentId || reference.documentId || null,
        notes: parsed.data.notes || null,
      },
      include: { reference: true },
    });

    return NextResponse.json({ success: true, item, deduplicated: false }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to add item to collection', detail: err.message }, { status: 500 });
  }
}
