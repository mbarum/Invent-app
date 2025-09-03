import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Shipping from './pages/Shipping';
import VinPicker from './pages/VinPicker';
import Reports from './pages/Reports';
import PlaceholderPage from './pages/PlaceholderPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Inventory from './pages/Inventory';
import B2BManagement from './pages/B2BManagement';
import { checkAuth, loginUser } from './services/api';
import { LoaderCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const authStatus = await checkAuth();
        setIsAuthenticated(authStatus);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    verifyAuth();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    await loginUser(email, password);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('authToken');
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <LoaderCircle className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    );
  }

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
      <Routes>
        {isAuthenticated ? (
          <Route path="/" element={<Layout onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="pos" element={<PlaceholderPage title="Point of Sale" />} />
            <Route path="sales" element={<PlaceholderPage title="Sales" />} />
            <Route path="customers" element={<PlaceholderPage title="Customers" />} />
            <Route path="invoices" element={<PlaceholderPage title="Invoices" />} />
            <Route path="quotations" element={<PlaceholderPage title="Quotations" />} />
            <Route path="shipping" element={<Shipping />} />
            <Route path="reports" element={<Reports />} />
            <Route path="vin-picker" element={<VinPicker />} />
            <Route path="b2b-management" element={<B2BManagement />} />
            <Route path="settings" element={<PlaceholderPage title="Settings" />} />
            <Route path="profile" element={<PlaceholderPage title="Profile" />} />
          </Route>
        ) : (
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        )}
      </Routes>
    </HashRouter>
  );
};

export default App;