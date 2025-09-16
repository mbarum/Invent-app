import { create } from 'zustand';
import { Product, Customer, Branch, Sale, Invoice, ShippingLabel, AppSettings, UserNotification } from '@masuma-ea/types';
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
  
  fetchInitialData: () => Promise<void>;
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

  fetchInitialData: async () => {
    if (get().isInitialDataLoaded) return;
    try {
      const [products, customers, branches, sales, legacyInvoices, shippingLabels, appSettings] = await Promise.all([
        getProducts(),
        getCustomers(),
        getBranches(),
        getSales(),
        getUnpaidInvoiceSnippets(),
        getShippingLabels(),
        getSettings(),
      ]);
      set({ products, customers, branches, sales, legacyInvoices, shippingLabels, appSettings, isInitialDataLoaded: true });
    } catch (error) {
      console.error("Failed to fetch initial shared data:", error);
      // Handle error appropriately, maybe set an error state
    }
  },
  
  refetchProducts: async () => {
    try {
      const products = await getProducts();
      set({ products });
    } catch (error) {
      console.error("Failed to refetch products:", error);
    }
  },

  refetchCustomers: async () => {
    try {
      const customers = await getCustomers();
      set({ customers });
    } catch (error) {
      console.error("Failed to refetch customers:", error);
    }
  },

  refetchSales: async () => {
    try {
      const sales = await getSales();
      set({ sales });
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
