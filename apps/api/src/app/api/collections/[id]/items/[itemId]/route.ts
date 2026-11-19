import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: collectionId, itemId } = await params;

    const item = await prisma.collectionItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.collectionId !== collectionId) {
      return NextResponse.json({ error: 'Collection item not found' }, { status: 404 });
    }

    // Removing an item must not delete its Reference, previous runs, or reviews
    await prisma.collectionItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      success: true,
      message: 'Item removed from collection. Historical reference, verification runs, and reviews remain intact.',
      deletedItemId: itemId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to delete collection item', detail: err.message }, { status: 500 });
  }
}
