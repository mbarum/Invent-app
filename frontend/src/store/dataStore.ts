import { create } from 'zustand';
import { Product, Customer, Branch, Sale, Invoice, ShippingLabel } from '@masuma-ea/types';
import { getProducts, getCustomers, getBranches, getSales, getLegacyInvoices, getShippingLabels } from '../services/api';

interface SharedDataState {
  products: Product[];
  customers: Customer[];
  branches: Branch[];
  sales: Sale[];
  legacyInvoices: Pick<Invoice, 'id' | 'invoice_no'>[];
  shippingLabels: ShippingLabel[];
  isInitialDataLoaded: boolean;
  
  fetchInitialData: () => Promise<void>;
  refetchProducts: () => Promise<void>;
  refetchCustomers: () => Promise<void>;
  refetchSales: () => Promise<void>;
}

export const useDataStore = create<SharedDataState>((set, get) => ({
  products: [],
  customers: [],
  branches: [],
  sales: [],
  legacyInvoices: [],
  shippingLabels: [],
  isInitialDataLoaded: false,

  fetchInitialData: async () => {
    if (get().isInitialDataLoaded) return;
    try {
      const [products, customers, branches, sales, legacyInvoices, shippingLabels] = await Promise.all([
        getProducts(),
        getCustomers(),
        getBranches(),
        getSales(),
        getLegacyInvoices(),
        getShippingLabels(),
      ]);
      set({ products, customers, branches, sales, legacyInvoices, shippingLabels, isInitialDataLoaded: true });
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
  }

}));
