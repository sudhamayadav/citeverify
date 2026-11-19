import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the demo mode banner', () => {
    render(<App />);
    expect(screen.getByText(/LOCAL-ONLY DEMO MODE/)).toBeInTheDocument();
  });

  it('renders the CiteVerify heading', () => {
    render(<App />);
    expect(screen.getByText('CiteVerify')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<App />);
    expect(screen.getByText(/Loading health status/)).toBeInTheDocument();
  });
});
