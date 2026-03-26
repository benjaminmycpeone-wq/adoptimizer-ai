import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ margin: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
            An unexpected error occurred. Try refreshing the page.
          </p>
          <details style={{ textAlign: 'left', marginBottom: 16 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>Error details</summary>
            <pre style={{ fontSize: 11, color: 'var(--red)', marginTop: 8, overflow: 'auto' }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
          </details>
          <button
            className="btn bp"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
