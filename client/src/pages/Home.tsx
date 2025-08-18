import { useAuthStore } from '../store/auth';
import { LoginPage } from './Login';
import { MessagesPage } from './Messages';

export function HomePage() {
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);

  if (isLoggedIn) {
    return <MessagesPage />;
  }

  return <LoginPage />;
}
