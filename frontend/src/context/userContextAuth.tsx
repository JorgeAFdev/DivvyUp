import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthResponse } from '@monorepo/shared';
import { getUserToken, removeSession, setStorageObject } from '../utils/localStorage';

interface AuthContextValue {
  token: string | null;
  login: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(getUserToken());

  useEffect(() => {
    const storedToken = getUserToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const login = (data: AuthResponse) => {
    setStorageObject(JSON.stringify(data));
    setToken(data.token);
  };

  const logout = () => {
    removeSession();
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider, useAuth };
