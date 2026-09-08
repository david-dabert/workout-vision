import { Component } from 'react';
import { tModule } from '../lib/LanguageContext';

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
    this._componentStack = errorInfo?.componentStack || '';
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Strip query params and reload to land on dashboard
    window.location.href = window.location.origin + window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const errorMessage = error?.message || String(error) || 'Unknown error';
      const stack = this._componentStack || '';
      const currentHash = typeof window !== 'undefined' ? window.location.hash : '';

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠</div>
            <h2 style={styles.title}>{tModule('err_title')}</h2>
            <p style={styles.message}>
              {tModule('err_message')}
            </p>
            <div style={styles.actions}>
              <button style={styles.primaryBtn} onClick={this.handleTryAgain}>
                {tModule('err_try_again')}
              </button>
              <button style={styles.secondaryBtn} onClick={this.handleReload}>
                {tModule('err_reload')}
              </button>
              <button style={styles.secondaryBtn} onClick={this.handleGoHome}>
                {tModule('err_go_home')}
              </button>
            </div>
            <details style={styles.details}>
              <summary style={styles.detailsToggle}>{tModule('err_show_details')}</summary>
              <pre style={styles.detailsBody}>
                {currentHash ? `Page: ${currentHash}\n` : ''}{errorMessage}{stack ? `\n\nComponent:\n${stack.slice(0, 500)}` : ''}
              </pre>
            </details>
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
    flexWrap: 'wrap',
  },
  details: {
    marginTop: '1.25rem',
    textAlign: 'left',
  },
  detailsToggle: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary, rgba(240,240,245,0.5))',
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: '0',
  },
  detailsBody: {
    marginTop: '0.5rem',
    padding: '0.6rem 0.75rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.05))',
    borderRadius: '0.375rem',
    fontSize: '0.72rem',
    color: 'var(--text-secondary, rgba(240,240,245,0.5))',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowX: 'auto',
    maxHeight: '8rem',
    overflowY: 'auto',
    lineHeight: 1.4,
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
