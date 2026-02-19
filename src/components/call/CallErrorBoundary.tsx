import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CallErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[LiveCall] Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            textAlign: 'center' as const,
          }}>
            <p style={{ color: '#d91e1e', marginBottom: '12px' }}>Something went wrong</p>
            <p style={{ marginBottom: '16px' }}>{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={() => {
                // Try to close Mini App
                const tg = (window as any).Telegram?.WebApp;
                tg?.close?.();
              }}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '0',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
