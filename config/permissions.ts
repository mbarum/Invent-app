import { UserRole } from '../types';

// This holds public configuration variables for the frontend.
// In a production build process, these values would typically be
// injected via environment variables at build time.
export const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

export const PERMISSIONS = {
  // High-level permissions
  VIEW_DASHBOARD: 'view:dashboard',
  VIEW_INVENTORY: 'view:inventory',
  MANAGE_INVENTORY: 'manage:inventory', // Add, import, export
  CREATE_SALE: 'create:sale', // Access POS
  VIEW_REPORTS: 'view:reports',
  VIEW_CUSTOMERS: 'view:customers',
  MANAGE_USERS: 'manage:users',
  MANAGE_B2B: 'manage:b2b',
  MANAGE_SHIPPING: 'manage:shipping',
  USE_VIN_PICKER: 'use:vin_picker',
  EDIT_SETTINGS: 'edit:settings',
};

export const ROLES: Record<UserRole, string[]> = {
  [UserRole.SYSTEM_ADMINISTRATOR]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_B2B,
    PERMISSIONS.MANAGE_SHIPPING,
    PERMISSIONS.USE_VIN_PICKER,
    PERMISSIONS.EDIT_SETTINGS,
  ],
  [UserRole.INVENTORY_MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SHIPPING,
  ],
  [UserRole.PROCUREMENT_OFFICER]: [
    PERMISSIONS.VIEW_INVENTORY,
  ],
  [UserRole.SALES_STAFF]: [
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.MANAGE_SHIPPING,
    PERMISSIONS.USE_VIN_PICKER,
  ],
  [UserRole.WAREHOUSE_CLERK]: [
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_SHIPPING,
  ],
  [UserRole.ACCOUNTANT]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_CUSTOMERS,
  ],
  [UserRole.AUDITOR]: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_CUSTOMERS,
  ],
};