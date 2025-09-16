import axios from 'axios';
import { 
    User, Product, Sale, Customer, Invoice, Quotation, ShippingLabel, Branch, 
    BusinessApplication, AppSettings, DashboardStats, SalesChartDataPoint, 
    FastMovingProduct, VinSearchResult, CustomerTransactions, QuotationPayload,
    ApplicationStatus, ShippingStatus, QuotationStatus, StockRequest, 
    CreateStockRequestPayload, StockRequestStatus, NotificationPayload, AuditLog,
    // FIX: Add missing InvoiceStatus import.
    InvoiceStatus,
    MpesaTransaction
} from '@masuma-ea/types';

const api = axios.create({
  baseURL: '/api',
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message;
    return Promise.reject(new Error(message));
  }
);


// --- Auth ---
export const loginUser = async (email: string, password: string): Promise<{ token: string }> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
};

export const loginWithGoogle = async (token: string): Promise<{ token: string }> => {
    const { data } = await api.post('/auth/google', { token });
    return data;
};

export const registerUser = async (payload: {
    businessName: string; kraPin: string; contactName: string; contactEmail: string; contactPhone: string; password: string; certOfInc: File; cr12: File;
}) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, value);
    });
    const { data } = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
};

// --- Dashboard ---
export const getDashboardStats = async (range: {start: string, end: string}, branchId: number): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/stats', { params: { ...range, branchId } });
    return data;
};

export const getSalesChartData = async (range: {start: string, end: string}, branchId: number): Promise<SalesChartDataPoint[]> => {
    const { data } = await api.get('/dashboard/sales-chart', { params: { ...range, branchId } });
    return data;
};

export const getFastMovingProducts = async (range: {start: string, end: string}, branchId: number): Promise<FastMovingProduct[]> => {
    const { data } = await api.get('/dashboard/fast-moving', { params: { ...range, branchId } });
    return data;
};

export const updateSalesTarget = async (target: number): Promise<{ salesTarget: number }> => {
    const { data } = await api.put('/dashboard/sales-target', { target });
    return data;
};

// --- Products ---
export const getProducts = async (): Promise<Product[]> => {
    const { data } = await api.get('/products');
    return data;
};

export const createProduct = async (productData: Omit<Product, 'id'>): Promise<Product> => {
    const { data } = await api.post('/products', productData);
    return data;
};

export const updateProduct = async (id: string, productData: Partial<Product>): Promise<Product> => {
    const { data } = await api.put(`/products/${id}`, productData);
    return data;
};

export const deleteProduct = async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
};

export const importProducts = async (products: Omit<Product, 'id'>[]): Promise<{ count: number }> => {
    const { data } = await api.post('/products/import', { products });
    return data;
};

// --- VIN Picker ---
export const getPartsByVin = async (vin: string): Promise<VinSearchResult[]> => {
    const { data } = await api.get(`/vin-lookup/${vin}`);
    return data;
}

// --- Customers ---
export const getCustomers = async (): Promise<Customer[]> => {
    const { data } = await api.get('/customers');
    return data;
};

export const createCustomer = async (customerData: Omit<Customer, 'id'>): Promise<Customer> => {
    const { data } = await api.post('/customers', customerData);
    return data;
};

export const getCustomerTransactions = async (id: number): Promise<CustomerTransactions> => {
    const { data } = await api.get(`/customers/${id}/transactions`);
    return data;
};

// --- Sales ---
export const getSales = async (range?: {start: string, end: string}): Promise<Sale[]> => {
    const { data } = await api.get('/sales', { params: range });
    return data;
};

export const createSale = async (saleData: any): Promise<Sale> => {
    const { data } = await api.post('/sales', saleData);
    return data;
};

export const getSaleDetails = async (id: number): Promise<Sale> => {
    const { data } = await api.get(`/sales/${id}`);
    return data;
};

// --- Invoices ---
export const getInvoices = async (status?: InvoiceStatus): Promise<Invoice[]> => {
    const { data } = await api.get('/invoices', { params: { status } });
    return data;
};
export const getUnpaidInvoiceSnippets = async (): Promise<Pick<Invoice, 'id' | 'invoiceNo'>[]> => {
    const { data } = await api.get('/invoices/snippets/unpaid');
    return data;
}
export const getInvoiceDetails = async (id: number): Promise<Invoice> => {
    const { data } = await api.get(`/invoices/${id}`);
    return data;
};

// --- Quotations ---
export const getQuotations = async (): Promise<Quotation[]> => {
    const { data } = await api.get('/quotations');
    return data;
};
export const getQuotationDetails = async (id: number): Promise<Quotation> => {
    const { data } = await api.get(`/quotations/${id}`);
    return data;
};
export const createQuotation = async (payload: QuotationPayload): Promise<Quotation> => {
    const { data } = await api.post('/quotations', payload);
    return data;
};
export const updateQuotationStatus = async (id: number, status: QuotationStatus): Promise<Quotation> => {
    const { data } = await api.patch(`/quotations/${id}/status`, { status });
    return data;
};
export const convertQuotationToInvoice = async (id: number): Promise<Invoice> => {
    const { data } = await api.post(`/quotations/${id}/convert-to-invoice`);
    return data;
};

// --- Shipping ---
export const getShippingLabels = async (): Promise<ShippingLabel[]> => {
    const { data } = await api.get('/shipping');
    return data;
};
export const createShippingLabel = async (labelData: Partial<ShippingLabel>): Promise<ShippingLabel> => {
    const { data } = await api.post('/shipping', labelData);
    return data;
};
export const updateShippingLabelStatus = async (id: string, status: ShippingStatus): Promise<ShippingLabel> => {
    const { data } = await api.patch(`/shipping/${id}/status`, { status });
    return data;
};
export const getShipments = async (range: {start: string, end: string}): Promise<ShippingLabel[]> => {
    const { data } = await api.get('/reports/shipments', { params: range });
    return data;
};

// --- B2B ---
export const getB2BApplications = async (): Promise<BusinessApplication[]> => {
    const { data } = await api.get('/b2b/applications');
    return data;
};
export const updateB2BApplicationStatus = async (id: string, status: ApplicationStatus): Promise<BusinessApplication> => {
    const { data } = await api.patch(`/b2b/applications/${id}`, { status });
    return data;
};

// --- Stock Requests (B2B Portal) ---
export const createStockRequest = async (payload: CreateStockRequestPayload): Promise<StockRequest> => {
    const { data } = await api.post('/stock-requests', payload);
    return data;
};
export const getMyStockRequests = async (): Promise<StockRequest[]> => {
    const { data } = await api.get('/stock-requests/my-requests');
    return data;
};
export const getAllStockRequests = async (): Promise<StockRequest[]> => {
    const { data } = await api.get('/stock-requests');
    return data;
};
export const getStockRequestDetails = async (id: number): Promise<StockRequest> => {
    const { data } = await api.get(`/stock-requests/${id}`);
    return data;
};
export const updateStockRequestStatus = async (id: number, status: StockRequestStatus): Promise<StockRequest> => {
    const { data } = await api.patch(`/stock-requests/${id}/status`, { status });
    return data;
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
    const { data } = await api.get('/users');
    return data;
};
export const createUser = async (userData: Partial<User>): Promise<User> => {
    const { data } = await api.post('/users', userData);
    return data;
};
export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    const { data } = await api.put(`/users/${id}`, userData);
    return data;
};
export const updateCurrentUserPassword = async (payload: {currentPassword: string, newPassword: string}):Promise<void> => {
    await api.patch('/users/me/password', payload);
};

// --- Branches ---
export const getBranches = async (): Promise<Branch[]> => {
    const { data } = await api.get('/branches');
    return data;
};
export const createBranch = async (branchData: Omit<Branch, 'id'>): Promise<Branch> => {
    const { data } = await api.post('/branches', branchData);
    return data;
};
export const updateBranch = async (id: number, branchData: Partial<Branch>): Promise<Branch> => {
    const { data } = await api.put(`/branches/${id}`, branchData);
    return data;
};


// --- Settings ---
export const getSettings = async (): Promise<AppSettings> => {
    const { data } = await api.get('/settings');
    return data;
};
export const updateSettings = async (settings: AppSettings): Promise<AppSettings> => {
    const { data } = await api.put('/settings', settings);
    return data;
};

// --- M-Pesa ---
export const initiateMpesaPayment = async (payload: any): Promise<{ checkoutRequestId: string }> => {
    const { data } = await api.post('/mpesa/stk-push', payload);
    return data;
};
export const getMpesaPaymentStatus = async (checkoutRequestId: string): Promise<{ status: string, sale?: Sale, message?: string }> => {
    const { data } = await api.get(`/mpesa/status/${checkoutRequestId}`);
    return data;
};
export const getMpesaTransactions = async (page: number, limit: number, status: string): Promise<{transactions: MpesaTransaction[], total: number}> => {
    const { data } = await api.get('/mpesa/transactions', { params: { page, limit, status } });
    return data;
};


// --- Notifications ---
export const getNotifications = async (): Promise<NotificationPayload> => {
    const { data } = await api.get('/notifications');
    return data;
};

export const markNotificationsRead = async (ids: number[]): Promise<void> => {
    await api.post('/notifications/mark-read', { ids });
};

// --- Audit Logs ---
export const getAuditLogs = async (page: number, limit: number): Promise<{logs: AuditLog[], total: number}> => {
    const { data } = await api.get('/audit-logs', { params: { page, limit } });
    return data;
};