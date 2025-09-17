// FIX: Add missing React import to resolve namespace and JSX-related errors.
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// FIX: Remove .tsx file extensions from imports for proper module resolution.
import { AuthProvider, useAuth } from './contexts/AuthContext';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import ProtectedRoute from './components/ProtectedRoute';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Layout from './components/Layout';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Login from './pages/Login';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Register from './pages/Register';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Dashboard from './pages/Dashboard';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Inventory from './pages/Inventory';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Sales from './pages/Sales';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Customers from './pages/Customers';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import POS from './pages/POS';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Shipping from './pages/Shipping';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import VinPicker from './pages/VinPicker';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Reports from './pages/Reports';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Settings from './pages/Settings';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Users from './pages/Users';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Profile from './pages/Profile';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Invoices from './pages/Invoices';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Quotations from './pages/Quotations';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import B2BManagement from './pages/B2BManagement';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import B2BPortal from './pages/B2BPortal';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import Branches from './pages/Branches';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import AuditLogs from './pages/AuditLogs';
// FIX: Remove .tsx file extensions from imports for proper module resolution.
import MpesaTransactions from './pages/MpesaTransactions';

// FIX: Remove .ts file extensions from imports for proper module resolution.
import { PERMISSIONS } from './config/permissions';
import { UserRole } from '@masuma-ea/types';

// A wrapper to handle redirection for authenticated users trying to access login/register
// FIX: Updated to redirect to a role-appropriate default page instead of always '/dashboard'.
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, defaultRoute } = useAuth();
  if (isAuthenticated) {
      return <Navigate to={defaultRoute} replace />;
  }
  return <>{children}</>;
};

// FIX: A component to handle role-based redirection from the root path.
const HomeRedirect = () => {
    const { defaultRoute } = useAuth();
    return <Navigate to={defaultRoute} replace />;
};

// FIX: A component to handle fallback redirects to a safe, role-appropriate page.
const FallbackRedirect = () => {
    const { defaultRoute } = useAuth();
    return <Navigate to={defaultRoute} replace />;
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute permission={null}><Layout /></ProtectedRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD}><Dashboard /></ProtectedRoute>} />
            <Route path="pos" element={<ProtectedRoute permission={PERMISSIONS.USE_POS}><POS /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><Inventory /></ProtectedRoute>} />
            <Route path="sales" element={<ProtectedRoute permission={PERMISSIONS.VIEW_SALES}><Sales /></ProtectedRoute>} />
            <Route path="mpesa-transactions" element={<ProtectedRoute permission={PERMISSIONS.VIEW_MPESA_LOGS}><MpesaTransactions /></ProtectedRoute>} />
            <Route path="customers" element={<ProtectedRoute permission={PERMISSIONS.VIEW_CUSTOMERS}><Customers /></ProtectedRoute>} />
            <Route path="quotations" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_QUOTATIONS}><Quotations /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_INVOICES}><Invoices /></ProtectedRoute>} />
            <Route path="shipping" element={<ProtectedRoute permission={PERMISSIONS.VIEW_SHIPPING}><Shipping /></ProtectedRoute>} />
            <Route path="vin-picker" element={<ProtectedRoute permission={PERMISSIONS.USE_VIN_PICKER}><VinPicker /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Reports /></ProtectedRoute>} />
            <Route path="b2b-management" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_B2B_APPLICATIONS}><B2BManagement /></ProtectedRoute>} />
            <Route path="b2b-portal" element={<ProtectedRoute permission={PERMISSIONS.USE_B2B_PORTAL}><B2BPortal /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_USERS}><Users /></ProtectedRoute>} />
            <Route path="branches" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_BRANCHES}><Branches /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_SETTINGS}><Settings /></ProtectedRoute>} />
            <Route path="audit-logs" element={<ProtectedRoute permission={PERMISSIONS.VIEW_AUDIT_LOGS}><AuditLogs /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute permission={null}><Profile /></ProtectedRoute>} />
            {/* Fallback for any other route */}
            <Route path="*" element={<FallbackRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster 
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          className: '',
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
    </AuthProvider>
  );
};

export default App;