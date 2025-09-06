import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Shipping from './pages/Shipping.tsx';
import VinPicker from './pages/VinPicker.tsx';
import Reports from './pages/Reports.tsx';
import Sales from './pages/Sales.tsx';
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import Inventory from './pages/Inventory.tsx';
import B2BManagement from './pages/B2BManagement.tsx';
import Customers from './pages/Customers.tsx';
import POS from './pages/POS.tsx';
import Users from './pages/Users.tsx';
import Invoices from './pages/Invoices.tsx';
import Quotations from './pages/Quotations.tsx';
import Settings from './pages/Settings.tsx';
import Profile from './pages/Profile.tsx';
import { LoaderCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import { PERMISSIONS } from './config/permissions.ts';
import { UserRole } from '@masuma-ea/types';
import B2BPortal from './pages/B2BPortal.tsx';
import Branches from './pages/Branches.tsx';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <LoaderCircle className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    );
  }

  // B2B users get a different default route and layout
  if (isAuthenticated && user?.role === UserRole.B2B_CLIENT) {
    return (
       <Routes>
          <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/b2b-portal" replace />} />
              <Route path="b2b-portal" element={<ProtectedRoute permission={PERMISSIONS.CREATE_STOCK_REQUEST}><B2BPortal /></ProtectedRoute>} />
              <Route path="inventory" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><Inventory /></ProtectedRoute>} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/b2b-portal" replace />} />
          </Route>
       </Routes>
    )
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
          <Route path="branches" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_BRANCHES}><Branches /></ProtectedRoute>} />
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