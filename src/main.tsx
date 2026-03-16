import { StrictMode, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// import App from './App.tsx'


class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null, info: ErrorInfo | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, info: null };
  }
  componentDidCatch(_error: Error, info: ErrorInfo) {
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', fontFamily: 'monospace', height: '100vh', overflow: 'auto' }}>
          <h2>🚨 Hubo un error en la aplicación 🚨</h2>
          <p>Por favor, copia este texto y envíaselo a Antigravity:</p>
          <pre style={{ background: '#ffcdd2', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', fontWeight: 'bold' }}>
            {this.state.error?.toString()}
          </pre>
          <h3>Detalles Técnicos (Stack Trace):</h3>
          <pre style={{ background: '#ffcdd2', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
