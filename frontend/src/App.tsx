// FIX: Add missing React import to resolve namespace and JSX-related errors.
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import Layout from './components/Layout.tsx';
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Inventory from './pages/Inventory.tsx';
import Sales from './pages/Sales.tsx';
import Customers from './pages/Customers.tsx';
import POS from './pages/POS.tsx';
import Shipping from './pages/Shipping.tsx';
import VinPicker from './pages/VinPicker.tsx';
import Reports from './pages/Reports.tsx';
import Settings from './pages/Settings.tsx';
import Users from './pages/Users.tsx';
import Profile from './pages/Profile.tsx';
import Invoices from './pages/Invoices.tsx';
import Quotations from './pages/Quotations.tsx';
import B2BManagement from './pages/B2BManagement.tsx';
import B2BPortal from './pages/B2BPortal.tsx';
import Branches from './pages/Branches.tsx';
import AuditLogs from './pages/AuditLogs.tsx';

import { PERMISSIONS } from './config/permissions.ts';

// A wrapper to handle redirection for authenticated users trying to access login/register
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
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