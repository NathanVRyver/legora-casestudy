import { useAuthStore } from '../store/auth';

export function Header() {
  const { user, logout } = useAuthStore();

  if (!user) return null;

  return (
    <header className="messaging-card messaging-card-hover mb-8">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Messaging Platform</h1>
              <p className="text-sm text-slate-500">Welcome back, {user.username}</p>
            </div>
          </div>
          <button onClick={logout} className="messaging-button-secondary text-sm">
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
