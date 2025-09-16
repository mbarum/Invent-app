import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
// FIX: Remove .tsx file extension from import for proper module resolution.
import { useAuth } from '../contexts/AuthContext';
import { LoaderCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission: string | null; // Allow null for routes accessible to all logged-in users
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (!hasPermission(permission)) {
      // You can create a dedicated "Unauthorized" page
      return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
