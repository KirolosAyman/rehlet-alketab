import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ar } from '../i18n/ar';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-danger/10 p-6">
            <span className="text-4xl" aria-hidden="true">⚠️</span>
            <h2 className="mt-3 text-lg font-bold text-danger">حدث خطأ غير متوقع</h2>
            <p className="mt-2 text-sm text-muted">
              {this.state.error?.message || ar.errors.server}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={this.handleReload}>{ar.retry}</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
