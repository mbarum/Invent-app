


import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShoppingCart, Users, Truck, FileText, Wrench, BarChart2, Settings, UserCircle, LogOut, Building, Briefcase, FileClock, Smartphone } from 'lucide-react';
// FIX: Remove .tsx and .ts file extensions from imports for proper module resolution.
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/permissions';
// FIX: Changed import to remove file extension for proper module resolution.
import Logo from './Logo';

interface SidebarProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setSidebarOpen }) => {
  const { user, logout, hasPermission } = useAuth();

  const navLinkClasses = "flex items-center px-4 py-2.5 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors duration-200";
  const activeNavLinkClasses = "bg-orange-600 text-white";
  const childNavLinkClasses = "pl-12 pr-4 py-2 text-sm"; // Indented style for child links

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) => 
    isActive ? `${navLinkClasses} ${activeNavLinkClasses}` : navLinkClasses;
  
  const getChildNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${navLinkClasses} ${childNavLinkClasses} ${isActive ? activeNavLinkClasses : ''}`;

  
  const navLinks = [
    { to: "/dashboard", icon: <Home className="w-5 h-5 mr-3" />, label: "Dashboard", permission: PERMISSIONS.VIEW_DASHBOARD },
    { to: "/pos", icon: <ShoppingCart className="w-5 h-5 mr-3" />, label: "Point of Sale", permission: PERMISSIONS.USE_POS },
    { to: "/inventory", icon: <Wrench className="w-5 h-5 mr-3" />, label: "Inventory", permission: PERMISSIONS.VIEW_INVENTORY },
    { 
      to: "/sales", 
      icon: <BarChart2 className="w-5 h-5 mr-3" />, 
      label: "Sales", 
      permission: PERMISSIONS.VIEW_SALES,
      children: [
        { to: "/sales", label: "Sales History", permission: PERMISSIONS.VIEW_SALES },
        { to: "/mpesa-transactions", label: "M-Pesa Logs", permission: PERMISSIONS.VIEW_MPESA_LOGS, icon: <Smartphone className="w-4 h-4 mr-2" /> },
      ]
    },
    { to: "/customers", icon: <Users className="w-5 h-5 mr-3" />, label: "Customers", permission: PERMISSIONS.VIEW_CUSTOMERS },
    { to: "/quotations", icon: <FileText className="w-5 h-5 mr-3" />, label: "Quotations", permission: PERMISSIONS.MANAGE_QUOTATIONS },
    { to: "/invoices", icon: <FileClock className="w-5 h-5 mr-3" />, label: "Invoices", permission: PERMISSIONS.MANAGE_INVOICES },
    { to: "/shipping", icon: <Truck className="w-5 h-5 mr-3" />, label: "Shipping", permission: PERMISSIONS.VIEW_SHIPPING },
    { to: "/vin-picker", icon: <Wrench className="w-5 h-5 mr-3" />, label: "VIN Picker", permission: PERMISSIONS.USE_VIN_PICKER },
    { to: "/reports", icon: <BarChart2 className="w-5 h-5 mr-3" />, label: "Reports", permission: PERMISSIONS.VIEW_REPORTS },
  ];

  const b2bLinks = [
    { to: "/b2b-portal", icon: <Briefcase className="w-5 h-5 mr-3" />, label: "B2B Portal", permission: PERMISSIONS.USE_B2B_PORTAL },
  ];
  
  const adminLinks = [
    { to: "/b2b-management", icon: <Briefcase className="w-5 h-5 mr-3" />, label: "B2B Management", permission: PERMISSIONS.MANAGE_B2B_APPLICATIONS },
    { to: "/users", icon: <UserCircle className="w-5 h-5 mr-3" />, label: "Users", permission: PERMISSIONS.MANAGE_USERS },
    { to: "/branches", icon: <Building className="w-5 h-5 mr-3" />, label: "Branches", permission: PERMISSIONS.MANAGE_BRANCHES },
    { to: "/audit-logs", icon: <FileClock className="w-5 h-5 mr-3" />, label: "Audit Logs", permission: PERMISSIONS.VIEW_AUDIT_LOGS },
    { to: "/settings", icon: <Settings className="w-5 h-5 mr-3" />, label: "Settings", permission: PERMISSIONS.MANAGE_SETTINGS },
  ];

  return (
    <>
      <aside className={`no-print fixed inset-y-0 left-0 z-30 w-64 bg-gray-800 border-r border-gray-700 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-20 border-b border-gray-700 px-6">
             <Logo className="w-full h-auto" />
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            
            {navLinks.filter(link => hasPermission(link.permission)).map(link => (
              <div key={link.to}>
                <NavLink to={link.to} end={!link.children} className={getNavLinkClass} onClick={() => setSidebarOpen(false)}>
                  {link.icon}
                  {link.label}
                </NavLink>
                {link.children && (
                  <div className="space-y-1 mt-1">
                    {link.children.filter(child => hasPermission(child.permission)).map(child => (
                       <NavLink key={child.to} to={child.to} className={getChildNavLinkClass} onClick={() => setSidebarOpen(false)}>
                         {child.icon}
                         {child.label}
                       </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {b2bLinks.some(link => hasPermission(link.permission)) && <hr className="border-gray-600 my-4" />}
            {b2bLinks.filter(link => hasPermission(link.permission)).map(link => (
              <NavLink key={link.to} to={link.to} className={getNavLinkClass} onClick={() => setSidebarOpen(false)}>
                {link.icon}
                {link.label}
              </NavLink>
            ))}

            {adminLinks.some(link => hasPermission(link.permission)) && <hr className="border-gray-600 my-4" />}
            {adminLinks.filter(link => hasPermission(link.permission)).map(link => (
              <NavLink key={link.to} to={link.to} className={getNavLinkClass} onClick={() => setSidebarOpen(false)}>
                {link.icon}
                {link.label}
              </NavLink>
            ))}

          </nav>

           <div className="p-4 border-t border-gray-700">
              <NavLink to="/profile" className={getNavLinkClass}>
                <UserCircle className="w-5 h-5 mr-3" />
                Profile
              </NavLink>
              <button onClick={logout} className={`${navLinkClasses} w-full`}>
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </button>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
