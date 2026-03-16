import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error', { error, errorInfo }, 'ErrorBoundary');
    
    // You can also log to an error reporting service here
    // e.g., Sentry, Bugsnag, etc.
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-content">
            <AlertTriangle size={48} className="text-danger mb-4" />
            <h2 className="text-h2 mb-2">¡Ups! Algo salió mal</h2>
            <p className="text-body text-muted mb-6">
              Ha ocurrido un error inesperado. Por favor intentá recargar la página.
            </p>
            {this.state.error && (
              <details className="error-details mb-6">
                <summary className="text-small text-muted cursor-pointer">
                  Ver detalles del error
                </summary>
                <pre className="error-stack text-micro mt-2 p-4 bg-surface rounded-lg overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={20} />
              Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
