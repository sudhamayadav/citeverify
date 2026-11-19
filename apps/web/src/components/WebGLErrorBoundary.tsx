import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[WebGL/3D ErrorBoundary caught]:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="region"
          aria-label="3D rendering fallback"
          style={{
            padding: '1rem',
            border: '1px dashed #cbd5e1',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            color: '#475569',
            textAlign: 'center',
            fontSize: '0.875rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>3D Rendering Unavailable</p>
          <p style={{ margin: '0.25rem 0 0 0' }}>Switched to accessible 2D view fallback.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
