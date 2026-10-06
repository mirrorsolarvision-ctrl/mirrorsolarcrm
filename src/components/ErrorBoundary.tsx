import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  showHomeButton?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('CRM Uncaught Runtime Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClearSessionAndHome = () => {
    try {
      localStorage.removeItem('crm_session_user');
    } catch {
      // Ignore storage errors
    }
    window.location.href = '/role';
  };

  handleCopyDiagnostics = async () => {
    const { error, errorInfo } = this.state;
    const diagnosticPayload = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorMessage: error?.message || 'Unknown Error',
      errorStack: error?.stack || 'No stack trace available',
      componentStack: errorInfo?.componentStack || 'No component stack available'
    };

    const textToCopy = `--- SOLAR CRM DIAGNOSTIC REPORT ---\n` +
      `Time: ${diagnosticPayload.timestamp}\n` +
      `URL: ${diagnosticPayload.url}\n` +
      `Error: ${diagnosticPayload.errorMessage}\n\n` +
      `Stack Trace:\n${diagnosticPayload.errorStack}\n\n` +
      `Component Tree:\n${diagnosticPayload.componentStack}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, copied } = this.state;
      const { 
        fallbackTitle = 'Something went wrong',
        fallbackMessage = 'An unexpected error occurred in this view. Your saved data is secure in the database.',
        showHomeButton = true
      } = this.props;

      return (
        <div className="error-boundary-container" role="alert">
          <div className="error-boundary-card">
            <div className="error-icon-wrapper">
              <AlertTriangle size={32} />
            </div>

            <h2 className="error-boundary-title">{fallbackTitle}</h2>
            <p className="error-boundary-desc">{fallbackMessage}</p>

            <div className="error-boundary-actions">
              <button 
                className="error-btn error-btn-primary" 
                onClick={this.handleReset}
                title="Attempt to recover component"
              >
                <RefreshCw size={15} /> Try Again
              </button>
              
              <button 
                className="error-btn error-btn-outline" 
                onClick={this.handleReload}
                title="Reload full application"
              >
                Reload App
              </button>

              {showHomeButton && (
                <button 
                  className="error-btn error-btn-danger" 
                  onClick={this.handleClearSessionAndHome}
                  title="Reset session and return to role selection"
                >
                  <Home size={15} /> Reset to Home
                </button>
              )}
            </div>

            <div>
              <button 
                className="error-details-toggle"
                onClick={() => this.setState({ showDetails: !showDetails })}
                type="button"
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showDetails ? 'Hide Diagnostic Details' : 'Show Diagnostic Details'}
              </button>

              {showDetails && (
                <div className="error-details-box">
                  <div className="error-details-header">
                    <span>Technical Diagnostics</span>
                    <button 
                      className="copy-diagnostics-btn"
                      onClick={this.handleCopyDiagnostics}
                      type="button"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy Report'}
                    </button>
                  </div>
                  <div className="error-details-content">
                    {error?.name}: {error?.message}
                    {'\n\n'}
                    {error?.stack}
                    {errorInfo?.componentStack && `\n\nComponent Stack:${errorInfo.componentStack}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
