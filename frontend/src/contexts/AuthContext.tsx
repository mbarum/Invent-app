import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { User } from '@masuma-ea/types';
import { loginUser, loginWithGoogle as apiLoginWithGoogle } from '../services/api.ts';
import { ROLES } from '../config/permissions.ts';

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
    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      businessId: payload.businessId,
      businessName: payload.businessName,
      status: payload.status || 'Active', // The user must be active to log in.
      customer_id: payload.customerId,
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
        try {
            const token = sessionStorage.getItem('authToken');
            if (token) {
                const decodedUser = decodeToken(token);
                setUser(decodedUser);
            }
        } catch (error) {
            console.error("Auth initialization error", error);
            setUser(null);
            sessionStorage.removeItem('authToken');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleLogin = (token: string) => {
        sessionStorage.setItem('authToken', token);
        const decodedUser = decodeToken(token);
        setUser(decodedUser);
    };

    const login = async (email: string, pass: string) => {
        const { token } = await loginUser(email, pass);
        handleLogin(token);
    };

    const loginWithGoogle = async (googleToken: string) => {
        const { token } = await apiLoginWithGoogle(googleToken);
        handleLogin(token);
    };

    const logout = () => {
        sessionStorage.removeItem('authToken');
        setUser(null);
        // Navigate to login page, usually handled in App component
    };

    const hasPermission = useMemo(() => (permission: string | null): boolean => {
        if (permission === null) return true; // Permissions with null are public to logged-in users
        if (!user || !user.role) return false;
        const userPermissions = ROLES[user.role] || [];
        return userPermissions.includes(permission);
    }, [user]);


    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        logout,
        hasPermission,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};