import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { Pipeline3D, Pipeline2DFallback } from './Pipeline3D';
import { CitationGraph3D, CitationGraph2DFallback } from './CitationGraph3D';

// Component that intentionally throws to test WebGL error boundary
function ThrowingComponent(): React.ReactElement {
  throw new Error('WebGL Context Lost or Not Supported');
}

describe('Milestone 7 3D Visualizations & Fallback Suite', () => {
  // Test 1: WebGLErrorBoundary catches render errors and renders 2D fallback gracefully
  it('1. WebGLErrorBoundary catches WebGL/3D errors and displays fallback', () => {
    // Suppress console.warn during intentional error
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <WebGLErrorBoundary
        fallback={<div data-testid="custom-fallback">2D Recovery Fallback Active</div>}
      >
        <ThrowingComponent />
      </WebGLErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('2D Recovery Fallback Active')).toBeInTheDocument();

    spy.mockRestore();
  });

  // Test 2: Pipeline 2D Fallback renders all 5 pipeline stages accurately
  it('2. Pipeline 2D Fallback displays all 5 stages with statuses', () => {
    const customStages = [
      { id: '1', name: 'Stage 1: Ingestion', status: 'COMPLETED' as const, description: 'Done' },
      { id: '2', name: 'Stage 2: Extraction', status: 'COMPLETED' as const, description: 'Done' },
      { id: '3', name: 'Stage 3: Resolution', status: 'RUNNING' as const, description: 'Searching' },
      { id: '4', name: 'Stage 4: Retrieval', status: 'PENDING' as const, description: 'Queued' },
      { id: '5', name: 'Stage 5: Verdict', status: 'PENDING' as const, description: 'Queued' },
    ];

    render(<Pipeline2DFallback stages={customStages} />);

    expect(screen.getByText('Stage 1: Ingestion')).toBeInTheDocument();
    expect(screen.getByText('Stage 3: Resolution')).toBeInTheDocument();
    expect(screen.getByText('Stage 5: Verdict')).toBeInTheDocument();
    expect(screen.getByText('Searching')).toBeInTheDocument();
  });

  // Test 3: Citation Graph 2D Fallback renders complete hierarchy
  it('3. Citation Graph 2D Fallback renders document-claim-citation-evidence hierarchy', () => {
    const nodes = [
      { id: 'd1', type: 'DOCUMENT' as const, label: 'sample.pdf' },
      { id: 'c1', type: 'CLAIM' as const, label: 'App improved scores 30%' },
      { id: 'm1', type: 'CITATION_MENTION' as const, label: '[1]' },
      { id: 'r1', type: 'REFERENCE_CANDIDATE' as const, label: 'Smith 2022' },
      { id: 'p1', type: 'EVIDENCE_PASSAGE' as const, label: 'Pilot showed 12%' },
    ];
    const edges = [{ from: 'd1', to: 'c1', relation: 'contains' }];

    render(<CitationGraph2DFallback nodes={nodes} edges={edges} />);

    expect(screen.getByText('sample.pdf')).toBeInTheDocument();
    expect(screen.getByText('App improved scores 30%')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('Smith 2022')).toBeInTheDocument();
    expect(screen.getByText('Pilot showed 12%')).toBeInTheDocument();
  });

  // Test 4: Manual 2D Toggle switches mode without blocking UI
  it('4. Pipeline3D respects manual2D prop and toggles mode via callback', () => {
    const toggleSpy = vi.fn();
    render(<Pipeline3D manual2D={true} onToggle2D={toggleSpy} />);

    expect(screen.getByText(/Verification Pipeline \(2D View\)/)).toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: /Switch to 3D View/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });

  // Test 5: CitationGraph3D respects manual2D prop and toggles
  it('5. CitationGraph3D respects manual2D prop and renders 2D tree view', () => {
    const toggleSpy = vi.fn();
    render(<CitationGraph3D manual2D={true} onToggle2D={toggleSpy} />);

    expect(screen.getByText(/Citation Provenance Graph \(2D Tree View\)/)).toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: /Switch to 3D View/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });
});
