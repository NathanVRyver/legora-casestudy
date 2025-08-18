import { useEffect, ReactNode } from 'react';
import { useAuthStore } from '../store/auth';
import { grpcClient } from '../lib/api-client';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { initializeAuth, isInitialized, logout, login, setInitialized } = useAuthStore();

  useEffect(() => {
    async function initAuth() {
      initializeAuth();

      const currentState = useAuthStore.getState();
      if (currentState.token) {
        try {
          console.log('Validating stored token...');
          const validation = await grpcClient.validateToken(currentState.token);
          if (validation.success && validation.user && validation.token) {
            console.log('Token validation successful, updating auth state');
            login(validation.user, validation.token);
          } else {
            console.log('Token validation failed, clearing auth');
            logout();
          }
        } catch (_error) {
          console.error('Auth validation failed:', _error);
          logout();
        }
      } else {
        console.log('No token found in storage');
        setInitialized();
      }
    }

    initAuth();
  }, [initializeAuth, logout, login, setInitialized]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-2 border-slate-300/30 border-t-slate-400 rounded-full animate-spin"></div>
          <span className="text-slate-600 font-medium">Initializing...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
