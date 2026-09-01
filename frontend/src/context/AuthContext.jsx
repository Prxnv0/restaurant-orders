import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login, logout, fetchMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Try to restore session from cookie on mount
  const restoreSession = useCallback(async () => {
    try {
      const { user } = await fetchMe();
      setUser(user);
    } catch (_) {
      // Not logged in — that's fine, just leave user as null
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const handleLogin = async (email, password) => {
    setError(null);
    try {
      const { user } = await login(email, password);
      setUser(user);
      return { ok: true };
    } catch (err) {
      const message = err.message || 'Login failed';
      setError(message);
      return { ok: false, message };
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
    isAuthenticated: !!user,
    isManager: user?.role === 'MANAGER',
    isWaiter: user?.role === 'WAITER',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}