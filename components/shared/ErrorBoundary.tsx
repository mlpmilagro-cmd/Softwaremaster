import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }> {
  // FIX: All errors in this file were caused by a missing constructor in the React class component. Adding a constructor that calls `super(props)` and initializes `this.state` makes `this.props`, `this.state`, and `this.setState` available on the component instance.
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
    this.setState({error, errorInfo});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-gray-900 p-4">
            <div className="max-w-lg w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center">
                <div className="flex justify-center mb-4">
                    <AlertTriangle size={48} className="text-red-500"/>
                </div>
                <h2 className="text-2xl font-bold text-red-700 dark:text-red-300">¡Error Inesperado!</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2 mb-6">
                    La aplicación ha encontrado un problema. Por favor, intente recargar.
                </p>
                <details className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-left text-xs">
                    <summary className="cursor-pointer font-medium">Detalles del Error</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words">
                        {this.state.error?.toString()}
                        {this.state.errorInfo?.componentStack}
                    </pre>
                </details>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors font-semibold"
                >
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