import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EvidenceHighlighter } from './EvidenceHighlighter';
import { RoleSwitcher } from './RoleSwitcher';
import { HumanReviewPanel } from './HumanReviewPanel';
import { ReportExportPanel } from './ReportExportPanel';

describe('Milestone 6 UI Components Suite', () => {
  it('1. EvidenceHighlighter highlights contiguous quote within passage', () => {
    const text = 'The experiment yielded 95% efficacy across cohorts.';
    const quote = '95% efficacy';

    render(<EvidenceHighlighter fullText={text} quote={quote} quoteVerified={true} />);

    expect(screen.getByText('✓ Contiguous Quote Verified')).toBeInTheDocument();
    expect(screen.getByText(quote)).toBeInTheDocument();
  });

  it('2. EvidenceHighlighter warns when quote does not exist as contiguous span', () => {
    const text = 'The experiment yielded 95% efficacy across cohorts.';
    const hallucinatedQuote = 'non-existent hallucinated quote';

    render(<EvidenceHighlighter fullText={text} quote={hallucinatedQuote} quoteVerified={false} />);

    expect(screen.getByText(/Quote not found as contiguous span/i)).toBeInTheDocument();
  });

  it('3. RoleSwitcher renders local demo disclaimer and role buttons', () => {
    render(<RoleSwitcher />);
    expect(screen.getByText(/LOCAL DEMO MODE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Faculty Reviewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Researcher' })).toBeInTheDocument();
  });

  it('4. HumanReviewPanel disables review actions for Researcher demo role', () => {
    render(
      <HumanReviewPanel
        claimId="claim-123"
        claimText="Test claim statement"
        currentVerdict="SUPPORTED"
        currentRole="Researcher"
      />
    );
    expect(screen.getByText(/Review actions are locked for/i)).toBeInTheDocument();
  });

  it('5. HumanReviewPanel enables action form for Faculty Reviewer demo role', () => {
    render(
      <HumanReviewPanel
        claimId="claim-123"
        claimText="Test claim statement"
        currentVerdict="SUPPORTED"
        currentRole="Faculty Reviewer"
      />
    );
    expect(screen.getByText('Action:')).toBeInTheDocument();
    expect(screen.getByText('Submit Review Event')).toBeInTheDocument();
  });

  it('6. ReportExportPanel renders JSON and Markdown export triggers', () => {
    render(<ReportExportPanel jobId="job-456" />);
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
    expect(screen.getByText('Export Markdown')).toBeInTheDocument();
  });
});
