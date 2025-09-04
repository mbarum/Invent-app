import React from 'react';
import { ChevronDown, Bell, LogOut } from 'lucide-react';
import { Branch } from '@masuma-ea/types';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
    branches: Branch[];
    currentBranch: Branch;
    onBranchChange: (branch: Branch) => void;
    currencies: string[];
    currentCurrency: string;
    onCurrencyChange: (currency: string) => void;
}

const Header: React.FC<HeaderProps> = ({ branches, currentBranch, onBranchChange, currencies, currentCurrency, onCurrencyChange }) => {
  const { user, logout } = useAuth();
  
  return (
    <header className="no-print bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">Welcome to {currentBranch.name}</h1>
      </div>
      <div className="flex items-center space-x-6">
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

        <button className="text-gray-400 hover:text-white">
          <Bell className="w-6 h-6" />
        </button>
        {/* User Profile */}
        <div className="flex items-center space-x-3">
          <img
            className="w-10 h-10 rounded-full"
            src={`https://ui-avatars.com/api/?name=${user?.name}&background=f97316&color=fff`}
            alt="User avatar"
          />
          <div>
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
