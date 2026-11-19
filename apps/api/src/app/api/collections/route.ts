import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const CreateCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const collections = await prisma.researchCollection.findMany({
      include: {
        items: {
          include: {
            reference: {
              include: {
                candidates: {
                  orderBy: { matchScore: 'desc' },
                  take: 1,
                },
                forwardCitationSearchRuns: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ collections });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch collections', detail: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateCollectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
    }

    const collection = await prisma.researchCollection.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });

    return NextResponse.json({ success: true, collection }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to create collection', detail: err.message }, { status: 500 });
  }
}
