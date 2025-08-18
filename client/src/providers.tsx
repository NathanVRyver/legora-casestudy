import { ReactNode } from 'react';
import { AuthProvider } from './components/AuthProvider';
import { RealTimeProvider } from './components/RealTimeProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <RealTimeProvider>{children}</RealTimeProvider>
    </AuthProvider>
  );
}
