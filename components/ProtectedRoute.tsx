import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from './ui/Card';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactElement;
  permission: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
       <div className="flex flex-col h-full items-center justify-center">
        <Card className="w-full max-w-lg text-center">
            <CardContent className="p-10">
                <ShieldAlert className="mx-auto h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-3xl font-bold text-white">Access Denied</h1>
                <p className="text-gray-400 mt-2">You do not have the required permissions to view this page.</p>
                <p className="text-gray-500 mt-1">Please contact your system administrator if you believe this is an error.</p>
            </CardContent>
        </Card>
    </div>
    );
  }

  return children;
};

export default ProtectedRoute;
