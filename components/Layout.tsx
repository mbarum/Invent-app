
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { Branch, NotificationPayload } from '../types';
import toast from 'react-hot-toast';
import { getNotifications, getBranches } from '../services/api';
import Button from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { LoaderCircle } from 'lucide-react';

// Base currency is KES
const exchangeRates = {
    KES: 1,
    USD: 0.0078, // 1 KES = 0.0078 USD
    UGX: 29.15,  // 1 KES = 29.15 UGX
};

const Layout: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentCurrency, setCurrentCurrency] = useState<string>('KES');
  
  // Notification state
  const lastCheckTimestamp = useRef<string | null>(null);
  const notifiedLowStock = useRef(new Set<string>());
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchBranchData = async () => {
      try {
        const branchesData = await getBranches();
        setBranches(branchesData);
        if (branchesData.length > 0) {
          setCurrentBranch(branchesData[0]);
        }
      } catch (error) {
        console.error("Failed to fetch branches:", error);
        toast.error("Could not load branch information.");
      }
    };
    fetchBranchData();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
        try {
            const data: NotificationPayload = await getNotifications(lastCheckTimestamp.current || undefined);
            lastCheckTimestamp.current = data.serverTimestamp;

            // Handle new applications
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
                    {
                        duration: 10000,
                        icon: '🏢' // Building icon
                    }
                );
            });

            // Handle low stock
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
                        {
                            duration: 10000,
                            icon: '⚠️' // Warning icon
                        }
                    );
                }
            });

        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };
    
    // Fetch immediately on load, then set interval
    if (user) {
        fetchNotifications();
        const intervalId = setInterval(fetchNotifications, 20000); // Poll every 20 seconds
        return () => clearInterval(intervalId);
    }
  }, [navigate, user]);

  if (!currentBranch) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <LoaderCircle className="h-12 w-12 animate-spin text-orange-500" />
        <span className="ml-4">Loading branch data...</span>
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