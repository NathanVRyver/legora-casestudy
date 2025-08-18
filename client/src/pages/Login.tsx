import { useState } from 'react';
import { LoginForm } from '../components/LoginForm';
import { grpcClient } from '../lib/api-client';
import { useAuthStore } from '../store/auth';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore(state => state.login);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await grpcClient.login(email, password);

      if (response.success && response.user && response.token) {
        login(response.user, response.token);
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (_err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <div className="w-8 h-8 bg-white rounded-lg"></div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
          <p className="text-slate-500">Sign in to your messaging account</p>
        </div>

        <LoginForm onLogin={handleLogin} error={error} loading={loading} />

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">Demo credentials: user@legora.com / legora123</p>
        </div>
      </div>
    </div>
  );
}
