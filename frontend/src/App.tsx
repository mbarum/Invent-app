// FIX: Add missing React import to resolve namespace and JSX-related errors.
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// FIX: Remove .tsx file extensions from imports for proper module resolution.
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import POS from './pages/POS';
import Shipping from './pages/Shipping';
import VinPicker from './pages/VinPicker';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Invoices from './pages/Invoices';
import Quotations from './pages/Quotations';
import B2BManagement from './pages/B2BManagement';
import B2BPortal from './pages/B2BPortal';
import Branches from './pages/Branches';
import AuditLogs from './pages/AuditLogs';
import MpesaTransactions from './pages/MpesaTransactions';

// FIX: Remove .ts file extensions from imports for proper module resolution.
import { PERMISSIONS } from './config/permissions';

// A wrapper to handle redirection for authenticated users trying to access login/register
// FIX: Explicitly typed as React.FC with children prop to fix type inference issue.
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" /> : <>{children}</>;
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
            <Route index element={<Navigate to="/dashboard" replace />} />
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
