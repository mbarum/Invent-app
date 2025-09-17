import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
// FIX: Remove .tsx and .ts extensions from imports for proper module resolution.
import Sidebar from './Sidebar';
import Header from './Header';
import { Branch } from '@masuma-ea/types';
import { useAuth } from '../contexts/AuthContext';
import { LoaderCircle } from 'lucide-react';
import { useDataStore } from '../store/dataStore';

// Base currency is KES
const exchangeRates = {
    KES: 1,
    USD: 0.0078, // 1 KES = 0.0078 USD
    UGX: 29.15,  // 1 KES = 29.15 UGX
};

const Layout: React.FC = () => {
  const { user } = useAuth();
  
  // Get shared data and initializer from Zustand store
  const { branches, isInitialDataLoaded, fetchInitialData, startNotificationPolling, stopNotificationPolling } = useDataStore();
  
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentCurrency, setCurrentCurrency] = useState<string>('KES');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Fetch all shared data once on layout mount
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Set the current branch once branch data is loaded
  useEffect(() => {
    if (branches.length > 0 && !currentBranch) {
      setCurrentBranch(branches[0]);
    }
  }, [branches, currentBranch]);

  // Start/stop notification polling based on user session
  useEffect(() => {
    if (user) {
        startNotificationPolling();
    }
    return () => {
        stopNotificationPolling();
    };
  }, [user, startNotificationPolling, stopNotificationPolling]);

  if (!isInitialDataLoaded || !currentBranch) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <LoaderCircle className="h-12 w-12 animate-spin text-orange-500" />
        <span className="ml-4">Loading application data...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 md:pl-64">
        <Header 
          onMenuClick={() => setSidebarOpen(true)}
          branches={branches}
          currentBranch={currentBranch}
          onBranchChange={setCurrentBranch}
          currencies={Object.keys(exchangeRates)}
          currentCurrency={currentCurrency}
          onCurrencyChange={setCurrentCurrency}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
           {isSidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            ></div>
          )}
          <Outlet context={{ currentBranch, currentCurrency, exchangeRates }} />
        </main>
      </div>
    </div>
  );
};

export default Layout;