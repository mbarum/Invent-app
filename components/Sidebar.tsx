
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Receipt,
  Users,
  FileText,
  FileQuestion,
  Truck,
  BarChart2,
  Car,
  Settings,
  UserCircle,
  Briefcase,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/permissions';

const MasumaLogo = () => (
    <div className="text-gray-200">
        <svg width="160" height="44" viewBox="0 0 160 44" fill="none" xmlns="http://www.w.org/2000/svg" aria-label="Masuma EA Hub Logo">
            <text
                x="0"
                y="28"
                fontFamily="Impact, Charcoal, 'Arial Narrow Bold', sans-serif"
                fontWeight="900"
                fontSize="32"
                fill="#F97316"
                letterSpacing="0.5"
            >
                MASUMA
            </text>
            <text
                x="142"
                y="18"
                fontFamily="Arial, sans-serif"
                fontWeight="normal"
                fontSize="8"
                fill="#F97316"
            >
                ®
            </text>
            <text
                x="0"
                y="40"
                fontFamily="Arial, sans-serif"
                fontWeight="bold"
                fontSize="9"
                fill="currentColor"
                letterSpacing="0.2"
            >
                AUTOPARTS EAST AFRICA
            </text>
        </svg>
    </div>
);


const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: PERMISSIONS.VIEW_DASHBOARD },
  { to: '/inventory', icon: Boxes, label: 'Inventory', permission: PERMISSIONS.VIEW_INVENTORY },
  { to: '/pos', icon: ShoppingCart, label: 'POS', permission: PERMISSIONS.CREATE_SALE },
  { to: '/sales', icon: Receipt, label: 'Sales', permission: PERMISSIONS.VIEW_REPORTS },
  { to: '/customers', icon: Users, label: 'Customers', permission: PERMISSIONS.VIEW_CUSTOMERS },
  { to: '/b2b-management', icon: Briefcase, label: 'B2B Accounts', permission: PERMISSIONS.MANAGE_B2B },
  { to: '/users', icon: UserCog, label: 'Users', permission: PERMISSIONS.MANAGE_USERS },
  { to: '/invoices', icon: FileText, label: 'Invoices', permission: PERMISSIONS.VIEW_REPORTS },
  { to: '/quotations', icon: FileQuestion, label: 'Quotations', permission: PERMISSIONS.CREATE_SALE },
  { to: '/shipping', icon: Truck, label: 'Shipping', permission: PERMISSIONS.MANAGE_SHIPPING },
  { to: '/reports', icon: BarChart2, label: 'Reports', permission: PERMISSIONS.VIEW_REPORTS },
  { to: '/vin-picker', icon: Car, label: 'VIN Picker', permission: PERMISSIONS.USE_VIN_PICKER },
];

const bottomNavItems = [
  { to: '/settings', icon: Settings, label: 'Settings', permission: PERMISSIONS.EDIT_SETTINGS },
  { to: '/profile', icon: UserCircle, label: 'Profile', permission: null }, // All users can see their profile
];

const NavItem: React.FC<{ to: string; icon: React.ElementType; label: string }> = ({ to, icon: Icon, label }) => (
  <li>
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center p-3 rounded-lg transition-colors text-gray-300 hover:bg-gray-700 hover:text-white ${
          isActive ? 'bg-gray-700 text-white' : ''
        }`
      }
    >
      <Icon className="w-5 h-5 mr-3" />
      <span className="font-medium">{label}</span>
    </NavLink>
  </li>
);

const Sidebar: React.FC = () => {
  const { hasPermission } = useAuth();

  const accessibleNavItems = navItems.filter(item => hasPermission(item.permission));
  const accessibleBottomNavItems = bottomNavItems.filter(item => item.permission === null || hasPermission(item.permission));

  return (
    <aside className="no-print w-64 bg-gray-800 flex flex-col p-4 border-r border-gray-700">
      <div className="px-3 py-4 mb-4">
        <MasumaLogo />
      </div>
      <nav className="flex-1">
        <ul className="space-y-2">
          {accessibleNavItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </ul>
      </nav>
      <nav>
        <ul className="space-y-2 pt-4 border-t border-gray-700">
          {accessibleBottomNavItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
