
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Bell, LogOut, Menu } from 'lucide-react';
import { Branch } from '@masuma-ea/types';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useDataStore } from '../store/dataStore.ts';

const useOnClickOutside = (ref: React.RefObject<HTMLDivElement>, handler: (event: MouseEvent | TouchEvent) => void) => {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
};

const timeSince = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

interface HeaderProps {
    branches: Branch[];
    currentBranch: Branch;
    onBranchChange: (branch: Branch) => void;
    currencies: string[];
    currentCurrency: string;
    onCurrencyChange: (currency: string) => void;
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ branches, currentBranch, onBranchChange, currencies, currentCurrency, onCurrencyChange, onMenuClick }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllAsRead } = useDataStore();
  const [isPanelOpen, setPanelOpen] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  
  useOnClickOutside(notificationPanelRef, () => setPanelOpen(false));
  
  const handleTogglePanel = () => {
      const newOpenState = !isPanelOpen;
      setPanelOpen(newOpenState);
      if (newOpenState && unreadCount > 0) {
          markAllAsRead();
      }
  };
  
  return (
    <header className="no-print bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center">
        <button onClick={onMenuClick} className="md:hidden mr-4 text-gray-400 hover:text-white" aria-label="Open sidebar">
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold">
          <span className="hidden sm:inline">Welcome to </span>
          {currentBranch.name}
        </h1>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Currency Switcher */}
        <div className="relative">
            <select
                value={currentCurrency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-md py-2 pl-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                aria-label="Select currency"
            >
                {currencies.map(currency => (
                    <option key={currency} value={currency}>{currency}</option>
                ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
        
        {/* Branch Switcher */}
        <div className="relative">
          <select
            value={currentBranch.id}
            onChange={(e) => {
                const selectedBranch = branches.find(b => b.id === parseInt(e.target.value));
                if (selectedBranch) {
                    onBranchChange(selectedBranch);
                }
            }}
            className="bg-gray-700 border border-gray-600 rounded-md py-2 pl-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
            aria-label="Select branch"
          >
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
        
        {/* Notification Bell */}
        <div className="relative" ref={notificationPanelRef}>
            <button onClick={handleTogglePanel} className="relative p-2 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white">
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-xs text-white">
                            {unreadCount}
                        </span>
                    </span>
                )}
            </button>
            {isPanelOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
                    <div className="p-3 border-b border-gray-700">
                        <h4 className="font-semibold text-white">Notifications</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(n => (
                                <Link to={n.link} key={n.id} onClick={() => setPanelOpen(false)} className="block p-3 hover:bg-gray-700/50 border-b border-gray-700/50">
                                    <p className={`text-sm ${!n.is_read ? 'text-gray-100' : 'text-gray-400'}`}>{n.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">{timeSince(new Date(n.created_at))}</p>
                                </Link>
                            ))
                        ) : (
                            <p className="p-4 text-sm text-gray-400 text-center">No new notifications.</p>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-3">
          <img
            className="w-10 h-10 rounded-full"
            src={`https://ui-avatars.com/api/?name=${user?.name}&background=f97316&color=fff`}
            alt="User avatar"
          />
          <div className="hidden md:block">
            <div className="font-medium">{user?.name}</div>
            <div className="text-sm text-gray-400">{user?.role}</div>
          </div>
          <button onClick={logout} className="p-2 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white" title="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
