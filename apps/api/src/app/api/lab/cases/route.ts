import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const DEMO_LEARNING_APP_CASE = {
  name: 'DEMO FIXTURE: 30% Learning App Study',
  description: 'Synthetic teaching source: pilot reports modest gain, not asserted 30% magnitude or scope.',
  claimText: 'A particular study found that a learning app improved test scores by 30%.',
  expectedVerdict: 'PARTLY_SUPPORTED',
  isSynthetic: true,
  sourceContent: JSON.stringify({
    title: 'Pilot Evaluation of Mobile Learning Application in Elementary Reading',
    authors: ['Doe, J.', 'Smith, A.'],
    publicationYear: 2023,
    venue: 'Journal of Educational Computing (Synthetic)',
    abstract: 'We evaluated a mobile app in a sample of 42 students. Average reading score improvements were 12% relative to baseline.',
    extractedPassages: [
      {
        section: 'Results',
        text: 'In our primary randomized cohort, students using the mobile learning app achieved a 12% improvement in standardized evaluation scores.',
      },
    ],
  }),
};

export async function GET() {
  try {
    let cases = await prisma.labCase.findMany({
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (cases.length === 0) {
      // Preload synthetic DEMO FIXTURE
      const demoCase = await prisma.labCase.create({
        data: DEMO_LEARNING_APP_CASE,
      });
      cases = [
        {
          ...demoCase,
          attempts: [],
        },
      ];
    }

    return NextResponse.json({
      cases: cases.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        claimText: c.claimText,
        expectedVerdict: c.expectedVerdict,
        isSynthetic: c.isSynthetic,
        sourceContent: c.sourceContent ? JSON.parse(c.sourceContent) : null,
        recentAttempts: c.attempts,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch lab cases', detail: err.message }, { status: 500 });
  }
}
