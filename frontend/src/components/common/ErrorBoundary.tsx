import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel rounded-2xl p-8 border border-rose-500/40 bg-obsidian/95 text-offWhite max-w-2xl mx-auto my-8 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-500/50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {this.props.fallbackTitle || 'Council Chamber Recovered from UI Exception'}
              </h2>
              <p className="text-xs text-gray-400">
                A rendering issue was intercepted safely. Your session state and data are preserved.
              </p>
            </div>
          </div>

          <div className="bg-obsidian border border-charcoal rounded-xl p-4 text-xs font-mono text-rose-300 overflow-x-auto max-h-40 whitespace-pre-wrap">
            {this.state.error?.message || 'Unknown component error'}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neonGreen text-obsidian text-xs font-semibold hover:bg-forestGreen transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Chamber View
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-charcoal text-gray-300 text-xs font-medium hover:bg-gray-800 transition-colors border border-charcoal"
            >
              <Home className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

