import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button, Card } from './ui/Common';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      let isPermissionError = false;

      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.error.includes('permission-denied')) {
            errorMessage = 'Você não tem permissão para acessar estes dados. Por favor, verifique se você está logado corretamente ou entre em contato com o administrador.';
            isPermissionError = true;
          }
        }
      } catch (e) {
        // Not a JSON error, use default message
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center space-y-6 border-red-100 bg-red-50/30">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-neutral-900">Ops! Algo deu errado</h2>
              <p className="text-neutral-600 text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <Button 
              onClick={this.handleReset}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>

            {isPermissionError && (
              <p className="text-xs text-neutral-400">
                Se o problema persistir, tente sair e entrar novamente na sua conta.
              </p>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
