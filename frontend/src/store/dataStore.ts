import { create } from 'zustand';
import { Product, Customer, Branch, Sale, Invoice, ShippingLabel, AppSettings, UserNotification, User, UserRole } from '@masuma-ea/types';
// FIX: Removed .ts extension for proper module resolution.
import { getProducts, getCustomers, getBranches, getSales, getUnpaidInvoiceSnippets, getShippingLabels, getSettings, getNotifications, markNotificationsRead } from '../services/api';
import toast from 'react-hot-toast';

let notificationInterval: number | undefined;

interface SharedDataState {
  products: Product[];
  customers: Customer[];
  branches: Branch[];
  sales: Sale[];
  legacyInvoices: Pick<Invoice, 'id' | 'invoiceNo'>[];
  shippingLabels: ShippingLabel[];
  appSettings: Partial<AppSettings>;
  notifications: UserNotification[];
  unreadCount: number;
  isInitialDataLoaded: boolean;
  
  fetchInitialData: (user: User) => Promise<void>;
  refetchProducts: () => Promise<void>;
  refetchCustomers: () => Promise<void>;
  refetchSales: () => Promise<void>;
  refetchBranches: () => Promise<void>;
  refetchSettings: () => Promise<void>;
  
  // Notification actions
  fetchNotifications: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startNotificationPolling: () => void;
  stopNotificationPolling: () => void;
}

export const useDataStore = create<SharedDataState>((set, get) => ({
  products: [],
  customers: [],
  branches: [],
  sales: [],
  legacyInvoices: [],
  shippingLabels: [],
  appSettings: {},
  notifications: [],
  unreadCount: 0,
  isInitialDataLoaded: false,

  fetchInitialData: async (user: User) => {
    if (get().isInitialDataLoaded) return;
    try {
      // FIX: Fetch data conditionally based on user role to prevent permission errors.
      const commonPromises = [
        getProducts(),
        getBranches(),
        getSettings(),
      ];

      const staffPromises = user.role !== UserRole.B2B_CLIENT ? [
        getCustomers(),
        getSales(),
        getUnpaidInvoiceSnippets(),
        getShippingLabels(),
      ] : [];

      const [
          productsResponse, 
          branches, 
          appSettings,
          customersResponse, // may be undefined
          salesResponse, // may be undefined
          legacyInvoices, // may be undefined
          shippingLabels, // may be undefined
      ] = await Promise.all([...commonPromises, ...staffPromises]);
      
      const products = Array.isArray(productsResponse) ? productsResponse : productsResponse.products;
      const customers = customersResponse ? customersResponse.customers : [];
      const sales = salesResponse ? (Array.isArray(salesResponse) ? salesResponse : salesResponse.sales) : [];

      set({ 
          products, 
          customers, 
          branches, 
          sales, 
          legacyInvoices: legacyInvoices || [], 
          shippingLabels: shippingLabels || [], 
          appSettings, 
          isInitialDataLoaded: true 
      });

    } catch (error) {
      console.error("Failed to fetch initial shared data:", error);
      toast.error("Failed to load application data. Permissions may be limited.");
    }
  },
  
  refetchProducts: async () => {
    try {
      // FIX: Handle both array and object responses from the API.
      const productsResponse = await getProducts();
      set({ products: Array.isArray(productsResponse) ? productsResponse : productsResponse.products });
    } catch (error) {
      console.error("Failed to refetch products:", error);
    }
  },

  refetchCustomers: async () => {
    try {
      // FIX: Extract the 'customers' array from the API response object.
      const customersResponse = await getCustomers();
      set({ customers: customersResponse.customers });
    } catch (error) {
      console.error("Failed to refetch customers:", error);
    }
  },

  refetchSales: async () => {
    try {
      // FIX: Handle both array and object responses from the API.
      const salesResponse = await getSales();
      set({ sales: Array.isArray(salesResponse) ? salesResponse : salesResponse.sales });
    } catch (error) {
      console.error("Failed to refetch sales:", error);
    }
  },

  refetchBranches: async () => {
    try {
      const branches = await getBranches();
      set({ branches });
    } catch (error) {
      console.error("Failed to refetch branches:", error);
    }
  },
  
  refetchSettings: async () => {
      try {
          const appSettings = await getSettings();
          set({ appSettings });
      } catch (error) {
          console.error("Failed to refetch settings:", error);
      }
  },
  
  // --- Notification Actions ---
  fetchNotifications: async () => {
      try {
          const data = await getNotifications();
          const alerts = data.userAlerts || [];
          const newUnreadCount = alerts.filter(n => !n.isRead).length;
          
          // Gently notify user only if there's a new, unseen alert
          if (newUnreadCount > get().unreadCount) {
             toast('You have new notifications.', { icon: '🔔' });
          }

          set({ notifications: alerts, unreadCount: newUnreadCount });

      } catch (error) {
          console.error("Failed to fetch notifications:", error);
      }
  },
  
  markAllAsRead: async () => {
      const unreadNotifications = get().notifications.filter(n => !n.isRead);
      if (unreadNotifications.length === 0) return;
      
      const idsToUpdate = unreadNotifications.map(n => n.id);
      
      // Optimistic UI update
      set(state => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true })),
          unreadCount: 0,
      }));

      try {
          await markNotificationsRead(idsToUpdate);
      } catch (error) {
          console.error("Failed to mark notifications as read:", error);
          // Revert UI update on failure
          toast.error("Could not sync notification status.");
          get().fetchNotifications(); // Re-fetch to get correct state
      }
  },
  
  startNotificationPolling: () => {
      get().stopNotificationPolling(); // Ensure no multiple intervals running
      get().fetchNotifications(); // Fetch immediately on start
      notificationInterval = window.setInterval(() => {
          get().fetchNotifications();
      }, 20000); // Poll every 20 seconds
  },
  
  stopNotificationPolling: () => {
      if(notificationInterval) {
          clearInterval(notificationInterval);
          notificationInterval = undefined;
      }
  }

}));