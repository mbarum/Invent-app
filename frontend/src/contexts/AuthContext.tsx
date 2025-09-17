import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { User, UserRole } from '@masuma-ea/types';
// FIX: Removed .ts extension for proper module resolution.
import * as api from '../services/api';
import { ROLES, PERMISSIONS } from '../config/permissions';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (token: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string | null) => boolean;
  defaultRoute: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const verifySession = useCallback(async () => {
        try {
            // This endpoint relies on the HttpOnly cookie being sent automatically by the browser.
            const currentUser = await api.verifyAuth();
            setUser(currentUser);
        } catch (error) {
            // If the request fails (e.g., 401 Unauthorized), it means there's no valid session.
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Verify session on initial app load.
        verifySession();
    }, [verifySession]);

    const handleLoginSuccess = (data: api.LoginResponse) => {
        // The backend sets the HttpOnly cookie. The frontend just needs to update the user state.
        setUser(data.user);
    };

    const login = async (email: string, password: string) => {
        const data = await api.login(email, password);
        handleLoginSuccess(data);
    };
    
    const loginWithGoogle = async (token: string) => {
        const data = await api.loginWithGoogle(token);
        handleLoginSuccess(data);
    };

    const logout = async () => {
        try {
            // Call the backend endpoint to clear the HttpOnly cookie.
            await api.logoutUser();
        } catch (error) {
            console.error("Logout API call failed, logging out client-side anyway.", error);
        } finally {
            // Clear the user state on the client.
            setUser(null);
        }
    };
    
    const hasPermission = useCallback((permission: string | null): boolean => {
        if (!user) return false;
        
        // If permission is null, it means the route is accessible to any logged-in user.
        if (permission === null) return true;
        
        const userPermissions = ROLES[user.role as UserRole] || [];
        
        // System Admin has all permissions implicitly.
        if (user.role === UserRole.SYSTEM_ADMINISTRATOR) {
            return true;
        }

        return userPermissions.includes(permission);
    }, [user]);

    // FIX: Calculate a safe default route based on user role and permissions to prevent redirect loops.
    const defaultRoute = useMemo(() => {
        if (!user) return '/login';
        if (user.role === UserRole.B2B_CLIENT) return '/b2b-portal';
        
        // Check permissions in order of preference for staff
        if (hasPermission(PERMISSIONS.VIEW_DASHBOARD)) return '/dashboard';
        if (hasPermission(PERMISSIONS.USE_POS)) return '/pos';
        if (hasPermission(PERMISSIONS.VIEW_INVENTORY)) return '/inventory';
        
        // Fallback for any authenticated user
        return '/profile';
    }, [user, hasPermission]);


    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        logout,
        hasPermission,
        defaultRoute
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