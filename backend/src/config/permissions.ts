import { UserRole } from '@masuma-ea/types';

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view:dashboard',

  // POS
  USE_POS: 'use:pos',

  // Inventory
  VIEW_INVENTORY: 'view:inventory',
  MANAGE_INVENTORY: 'manage:inventory', // Create, update, delete products

  // Sales
  VIEW_SALES: 'view:sales',
  VIEW_MPESA_LOGS: 'view:mpesa_logs',

  // Customers
  VIEW_CUSTOMERS: 'view:customers',
  MANAGE_CUSTOMERS: 'manage:customers', // Create, update

  // Quotations
  MANAGE_QUOTATIONS: 'manage:quotations',

  // Invoices
  MANAGE_INVOICES: 'manage:invoices',

  // Shipping
  VIEW_SHIPPING: 'view:shipping',
  MANAGE_SHIPPING: 'manage:shipping', // Create labels, update status

  // VIN Picker
  USE_VIN_PICKER: 'use:vin_picker',

  // Reports
  VIEW_REPORTS: 'view:reports',

  // B2B
  MANAGE_B2B_APPLICATIONS: 'manage:b2b_applications', // Approve/reject
  USE_B2B_PORTAL: 'use:b2b_portal', // For B2B clients to make requests

  // Admin
  MANAGE_USERS: 'manage:users',
  MANAGE_BRANCHES: 'manage:branches',
  MANAGE_SETTINGS: 'manage:settings',
  VIEW_AUDIT_LOGS: 'view:audit_logs',
};


export const ROLES: Record<UserRole, string[]> = {
  [UserRole.SYSTEM_ADMINISTRATOR]: Object.values(PERMISSIONS), // Has all permissions

  [UserRole.BRANCH_MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.USE_POS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_MPESA_LOGS,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_SHIPPING,
    PERMISSIONS.MANAGE_SHIPPING,
    PERMISSIONS.USE_VIN_PICKER,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_B2B_APPLICATIONS,
    PERMISSIONS.MANAGE_USERS, // Can manage users within their branch
  ],

  [UserRole.SALES_STAFF]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.USE_POS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_SHIPPING,
    PERMISSIONS.USE_VIN_PICKER,
  ],

  [UserRole.INVENTORY_MANAGER]: [
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.VIEW_SHIPPING,
    PERMISSIONS.MANAGE_SHIPPING,
    PERMISSIONS.USE_VIN_PICKER,
  ],

  [UserRole.B2B_CLIENT]: [
      PERMISSIONS.VIEW_INVENTORY, // View only, no prices
      PERMISSIONS.USE_VIN_PICKER,
      PERMISSIONS.USE_B2B_PORTAL,
  ],
};
