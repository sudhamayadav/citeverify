import { NextRequest, NextResponse } from 'next/server';
import { TavilyClient } from '@/lib/tavily';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { claimText } = body;

    if (!claimText) {
      return NextResponse.json({ error: 'claimText is required' }, { status: 400 });
    }

    let candidates: any[] = [];
    let provenance = { provider: 'Tavily Search', simulated: false };

    try {
      const tavily = new TavilyClient();
      const res = await tavily.search({
        query: claimText,
        max_results: 3,
        search_depth: 'basic',
      });

      candidates = res.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        label: 'CANDIDATE SOURCE — REQUIRES HUMAN REVIEW',
        note: 'Reverse citation discovery candidate. Not verified as the original citation.',
      }));
    } catch (e: any) {
      // In offline / unconfigured local dev mode, return structured candidate with honest label
      provenance.simulated = true;
      candidates = [
        {
          title: 'Candidate Evaluation of Educational Interventions',
          url: 'https://example.edu/papers/candidate-discovery-1',
          snippet: 'Study exploring learning interventions and outcome metrics.',
          label: 'CANDIDATE SOURCE — REQUIRES HUMAN REVIEW',
          note: 'Reverse citation discovery candidate. Not verified as the original citation.',
        },
      ];
    }

    return NextResponse.json({
      claimText,
      warning: 'CANDIDATE SOURCE — REQUIRES HUMAN REVIEW',
      candidates,
      provenance,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to search candidate citations', detail: err.message }, { status: 500 });
  }
}
