import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Strip query params and reload to land on dashboard
    window.location.href = window.location.origin + window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠</div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              An unexpected error occurred. You can try reloading the page or
              returning to the dashboard.
            </p>
            <div style={styles.actions}>
              <button style={styles.primaryBtn} onClick={this.handleReload}>
                Reload
              </button>
              <button style={styles.secondaryBtn} onClick={this.handleGoHome}>
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg, #000)',
    padding: '1.5rem',
  },
  card: {
    background: 'var(--glass-bg, rgba(255,255,255,0.012))',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.05))',
    borderRadius: '1rem',
    padding: '2.5rem 2rem',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center',
  },
  icon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    opacity: 0.7,
  },
  title: {
    color: 'var(--text-primary, #f0f0f5)',
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 0.75rem',
  },
  message: {
    color: 'var(--text-secondary, rgba(240,240,245,0.5))',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    margin: '0 0 1.5rem',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
  },
  primaryBtn: {
    background: 'var(--accent, #00f5d4)',
    color: 'var(--void, #000)',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'transparent',
    color: 'var(--text-primary, #f0f0f5)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.05))',
    borderRadius: '0.5rem',
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default ErrorBoundary;
