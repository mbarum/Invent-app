import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { User } from '../types';
import { loginUser, loginWithGoogle } from '../services/api';
import { ROLES } from '../config/permissions';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: (googleToken: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A simple JWT decoder
const decodeToken = (token: string): User | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Add expiry check
    if (payload.exp * 1000 < Date.now()) {
        sessionStorage.removeItem('authToken');
        return null;
    }
    // FIX: Add the required 'status' property to the decoded user object.
    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      businessId: payload.businessId,
      businessName: payload.businessName,
      status: payload.status || 'Active', // The user must be active to log in.
    };
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
};


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (token) {
      const decodedUser = decodeToken(token);
      setUser(decodedUser);
    }
    setIsLoading(false);
  }, []);
  
  const handleLogin = async (email: string, pass: string) => {
    const { token } = await loginUser(email, pass);
    sessionStorage.setItem('authToken', token);
    const decodedUser = decodeToken(token);
    setUser(decodedUser);
  };

  const handleGoogleLogin = async (googleToken: string) => {
      const { token } = await loginWithGoogle(googleToken);
      sessionStorage.setItem('authToken', token);
      const decodedUser = decodeToken(token);
      setUser(decodedUser);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('authToken');
    setUser(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    const userPermissions = ROLES[user.role];
    return userPermissions?.includes(permission) || false;
  };
  
  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login: handleLogin,
    loginWithGoogle: handleGoogleLogin,
    logout: handleLogout,
    hasPermission
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};