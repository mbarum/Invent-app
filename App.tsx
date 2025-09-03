

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Shipping from './pages/Shipping';
import VinPicker from './pages/VinPicker';
import Reports from './pages/Reports';
import Sales from './pages/Sales';
import Login from './pages/Login';
import Register from './pages/Register';
import Inventory from './pages/Inventory';
import B2BManagement from './pages/B2BManagement';
import Customers from './pages/Customers';
import POS from './pages/POS';
import Users from './pages/Users';
import Invoices from './pages/Invoices';
import Quotations from './pages/Quotations';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import { LoaderCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { PERMISSIONS } from './config/permissions';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <LoaderCircle className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <Routes>
      {isAuthenticated ? (
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD}><Dashboard /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><Inventory /></ProtectedRoute>} />
          <Route path="pos" element={<ProtectedRoute permission={PERMISSIONS.CREATE_SALE}><POS /></ProtectedRoute>} />
          <Route path="sales" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Sales /></ProtectedRoute>} />
          <Route path="customers" element={<ProtectedRoute permission={PERMISSIONS.VIEW_CUSTOMERS}><Customers /></ProtectedRoute>} />
          <Route path="b2b-management" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_B2B}><B2BManagement /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_USERS}><Users /></ProtectedRoute>} />
          <Route path="invoices" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Invoices /></ProtectedRoute>} />
          <Route path="quotations" element={<ProtectedRoute permission={PERMISSIONS.CREATE_SALE}><Quotations /></ProtectedRoute>} />
          <Route path="shipping" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_SHIPPING}><Shipping /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Reports /></ProtectedRoute>} />
          <Route path="vin-picker" element={<ProtectedRoute permission={PERMISSIONS.USE_VIN_PICKER}><VinPicker /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute permission={PERMISSIONS.EDIT_SETTINGS}><Settings /></ProtectedRoute>} />
          <Route path="profile" element={<Profile />} />
        </Route>
      ) : (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </>
      )}
    </Routes>
  );
};


const App: React.FC = () => {
  return (
    <HashRouter>
       <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1F2937', // bg-gray-800
            color: '#F3F4F6', // text-gray-100
            border: '1px solid #374151', // border-gray-700
          },
          success: {
            iconTheme: {
              primary: '#F97316', // text-orange-500
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444', // text-red-500
              secondary: '#FFFFFF',
            },
          },
        }}
      />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
};

export default App;