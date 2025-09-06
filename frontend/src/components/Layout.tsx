import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.tsx';
import Header from './Header.tsx';
import { Branch, NotificationPayload } from '@masuma-ea/types';
import toast from 'react-hot-toast';
import { getNotifications } from '../services/api.ts';
import Button from './ui/Button.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { LoaderCircle } from 'lucide-react';
import { useDataStore } from '../store/dataStore.ts';

// Base currency is KES
const exchangeRates = {
    KES: 1,
    USD: 0.0078, // 1 KES = 0.0078 USD
    UGX: 29.15,  // 1 KES = 29.15 UGX
};

const Layout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Get shared data and initializer from Zustand store
  const { branches, isInitialDataLoaded, fetchInitialData } = useDataStore();
  
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentCurrency, setCurrentCurrency] = useState<string>('KES');
  
  // Notification state
  const lastCheckTimestamp = useRef<string | null>(null);
  const notifiedLowStock = useRef(new Set<string>());
  
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

  useEffect(() => {
    const fetchNotifications = async () => {
        try {
            const data: NotificationPayload = await getNotifications(lastCheckTimestamp.current || undefined);
            lastCheckTimestamp.current = data.serverTimestamp;

            data.newApplications.forEach(app => {
                toast(
                    (t) => (
                        <div className="flex items-center justify-between w-full">
                            <span className="text-sm mr-4">
                                New B2B App: <b>{app.businessName}</b>
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => {
                                navigate('/b2b-management');
                                toast.dismiss(t.id);
                            }}>
                                View
                            </Button>
                        </div>
                    ),
                    { duration: 10000, icon: '🏢' }
                );
            });

            data.lowStockProducts.forEach(product => {
                if (!notifiedLowStock.current.has(product.id)) {
                    notifiedLowStock.current.add(product.id);
                    toast.error(
                        (t) => (
                            <div className="flex items-center justify-between w-full">
                                <span className="text-sm mr-4">
                                    Low Stock: <b>{product.name}</b> ({product.stock} left)
                                </span>
                                <Button size="sm" variant="ghost" onClick={() => {
                                    navigate('/inventory');
                                    toast.dismiss(t.id);
                                }}>
                                    View
                                </Button>
                            </div>
                        ),
                        { duration: 10000, icon: '⚠️' }
                    );
                }
            });

        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };
    
    if (user) {
        fetchNotifications();
        const intervalId = setInterval(fetchNotifications, 20000);
        return () => clearInterval(intervalId);
    }
  }, [navigate, user]);

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
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header 
          branches={branches}
          currentBranch={currentBranch}
          onBranchChange={setCurrentBranch}
          currencies={Object.keys(exchangeRates)}
          currentCurrency={currentCurrency}
          onCurrencyChange={setCurrentCurrency}
        />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet context={{ currentBranch, currentCurrency, exchangeRates }} />
        </main>
      </div>
    </div>
  );
};

export default Layout;