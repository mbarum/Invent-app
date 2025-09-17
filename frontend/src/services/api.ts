import axios from 'axios';
import { 
    User, Product, Sale, Customer, Branch, BusinessApplication, 
    ShippingLabel, Quotation, Invoice, AppSettings, DashboardStats, SalesChartDataPoint, 
    FastMovingProduct, VinSearchResult, CustomerTransactions, QuotationPayload, CreateStockRequestPayload, 
    StockRequest, AuditLog, MpesaTransaction, NotificationPayload, InvoiceStatus
} from '@masuma-ea/types';

// --- Axios Instance Setup ---
const api = axios.create({
    baseURL: '/api', // Proxied by Vite to the backend
    withCredentials: true, // IMPORTANT: This allows cookies to be sent with requests
});

// Interceptor to handle API errors globally
api.interceptors.response.use(
    response => response,
    error => {
        const message = error.response?.data?.message || error.message || 'An unknown error occurred';
        // You can add more robust error handling here, e.g., redirecting to login on 401
        if (error.response?.status === 401 && window.location.pathname !== '/login') {
            // The AuthContext will handle the logout flow
        }
        return Promise.reject(new Error(message));
    }
);


// --- TYPE DEFINITIONS ---
// The login response from the backend no longer includes a token.
export interface LoginResponse {
    user: User;
}

export interface RegisterPayload extends Omit<BusinessApplication, 'id' | 'status' | 'submittedAt' | 'certOfIncUrl' | 'cr12Url'> {
    password?: string;
    certOfInc: File;
    cr12: File;
}

// --- API FUNCTIONS ---

// Auth
export const login = (email: string, password: string): Promise<LoginResponse> => api.post('/auth/login', { email, password }).then(res => res.data);
export const loginWithGoogle = (token: string): Promise<LoginResponse> => api.post('/auth/google', { token }).then(res => res.data);
// This endpoint verifies the session cookie and returns the user.
export const verifyAuth = (): Promise<User> => api.get('/auth/verify').then(res => res.data);
// This endpoint clears the session cookie on the backend.
export const logoutUser = (): Promise<void> => api.post('/auth/logout');

export const registerUser = (payload: RegisterPayload) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
        if (value) {
           formData.append(key, value);
        }
    });
    return api.post('/auth/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);
};

// Dashboard
export const getDashboardStats = (range: { start: string, end: string }, branchId: number): Promise<DashboardStats> => api.get('/dashboard/stats', { params: { ...range, branchId } }).then(res => res.data);
export const getSalesChartData = (range: { start: string, end: string }, branchId: number): Promise<SalesChartDataPoint[]> => api.get('/dashboard/sales-chart', { params: { ...range, branchId } }).then(res => res.data);
export const getFastMovingProducts = (range: { start: string, end: string }, branchId: number): Promise<FastMovingProduct[]> => api.get('/dashboard/fast-moving', { params: { ...range, branchId } }).then(res => res.data);
export const updateSalesTarget = (salesTarget: number): Promise<{ salesTarget: number }> => api.put('/dashboard/sales-target', { salesTarget }).then(res => res.data);

// Products
export const getProducts = (params?: any): Promise<{products: Product[], total: number} | Product[]> => api.get('/products', { params }).then(res => res.data);
export const createProduct = (product: Omit<Product, 'id'>): Promise<Product> => api.post('/products', product).then(res => res.data);
export const updateProduct = (id: string, product: Partial<Product>): Promise<Product> => api.put(`/products/${id}`, product).then(res => res.data);
export const deleteProduct = (id: string): Promise<void> => api.delete(`/products/${id}`);
export const importProducts = (products: Omit<Product, 'id'>[]): Promise<void> => api.post('/products/import', products).then(res => res.data);

// Customers
export const getCustomers = (params?: any): Promise<{ customers: any[], total: number }> => api.get('/customers', { params }).then(res => res.data);
export const createCustomer = (customer: Omit<Customer, 'id'>): Promise<Customer> => api.post('/customers', customer).then(res => res.data);
export const getCustomerTransactions = (id: number): Promise<CustomerTransactions> => api.get(`/customers/${id}/transactions`).then(res => res.data);

// Branches
export const getBranches = (): Promise<Branch[]> => api.get('/branches').then(res => res.data);
export const createBranch = (branch: Omit<Branch, 'id'>): Promise<Branch> => api.post('/branches', branch).then(res => res.data);
export const updateBranch = (id: number, branch: Partial<Branch>): Promise<Branch> => api.put(`/branches/${id}`, branch).then(res => res.data);


// Sales & POS
export const getSales = (params?: any): Promise<Sale[] | {sales: Sale[], total: number}> => api.get('/sales', { params }).then(res => res.data);
export const getSaleDetails = (id: number): Promise<Sale> => api.get(`/sales/${id}`).then(res => res.data);
export const createSale = (saleData: any): Promise<Sale> => api.post('/sales', saleData).then(res => res.data);

// Invoices
export const getInvoices = (status?: InvoiceStatus): Promise<Invoice[]> => api.get('/invoices', { params: { status } }).then(res => res.data);
export const getInvoiceDetails = (id: number): Promise<Invoice> => api.get(`/invoices/${id}`).then(res => res.data);
export const getUnpaidInvoiceSnippets = (): Promise<Pick<Invoice, 'id' | 'invoiceNo'>[]> => api.get('/invoices', { params: { status: 'Unpaid', snippets: true } }).then(res => res.data);
export const convertQuotationToInvoice = (quotationId: number): Promise<Invoice> => api.post(`/invoices/from-quotation/${quotationId}`).then(res => res.data);

// Quotations
export const getQuotations = (): Promise<Quotation[]> => api.get('/quotations').then(res => res.data);
export const getQuotationDetails = (id: number): Promise<Quotation> => api.get(`/quotations/${id}`).then(res => res.data);
export const createQuotation = (payload: QuotationPayload): Promise<Quotation> => api.post('/quotations', payload).then(res => res.data);
export const updateQuotationStatus = (id: number, status: string): Promise<Quotation> => api.patch(`/quotations/${id}/status`, { status }).then(res => res.data);

// Shipping
export const getShippingLabels = (): Promise<ShippingLabel[]> => api.get('/shipping').then(res => res.data);
export const createShippingLabel = (labelData: Partial<ShippingLabel>): Promise<ShippingLabel> => api.post('/shipping', labelData).then(res => res.data);
export const updateShippingLabelStatus = (id: string, status: string): Promise<ShippingLabel> => api.patch(`/shipping/${id}/status`, { status }).then(res => res.data);

// VIN Picker
export const getPartsByVin = (vin: string): Promise<VinSearchResult[]> => api.get(`/vin/${vin}`).then(res => res.data);

// Reports
export const getShipments = (range?: { start: string, end: string }): Promise<ShippingLabel[]> => api.get('/reports/shipments', { params: range }).then(res => res.data);

// B2B Management
export const getB2BApplications = (): Promise<BusinessApplication[]> => api.get('/b2b/applications').then(res => res.data);
export const updateB2BApplicationStatus = (id: string, status: string): Promise<BusinessApplication> => api.patch(`/b2b/applications/${id}/status`, { status }).then(res => res.data);

// Stock Requests
export const getMyStockRequests = (): Promise<StockRequest[]> => api.get('/stock-requests/my').then(res => res.data);
export const getAllStockRequests = (): Promise<StockRequest[]> => api.get('/stock-requests/all').then(res => res.data);
export const getStockRequestDetails = (id: number): Promise<StockRequest> => api.get(`/stock-requests/${id}`).then(res => res.data);
export const createStockRequest = (payload: CreateStockRequestPayload): Promise<StockRequest> => api.post('/stock-requests', payload).then(res => res.data);
export const updateStockRequestStatus = (id: number, status: string): Promise<StockRequest> => api.patch(`/stock-requests/${id}/status`, { status }).then(res => res.data);

// Users
export const getUsers = (): Promise<User[]> => api.get('/users').then(res => res.data);
export const createUser = (userData: Partial<User>): Promise<User> => api.post('/users', userData).then(res => res.data);
export const updateUser = (id: string, userData: Partial<User>): Promise<User> => api.put(`/users/${id}`, userData).then(res => res.data);
export const updateCurrentUserPassword = (passwordData: any): Promise<void> => api.put('/users/me/password', passwordData).then(res => res.data);

// Settings
export const getSettings = (): Promise<AppSettings> => api.get('/settings').then(res => res.data);
export const updateSettings = (settings: Partial<AppSettings>): Promise<AppSettings> => api.put('/settings', settings).then(res => res.data);

// Audit Logs
export const getAuditLogs = (page: number, limit: number): Promise<{ logs: AuditLog[], total: number }> => api.get('/audit-logs', { params: { page, limit } }).then(res => res.data);

// Notifications
export const getNotifications = (): Promise<NotificationPayload> => api.get('/notifications').then(res => res.data);
export const markNotificationsRead = (ids: number[]): Promise<void> => api.post('/notifications/mark-read', { ids }).then(res => res.data);

// M-Pesa
export const initiateMpesaPayment = (payload: { amount: number, phoneNumber: string, [key: string]: any }): Promise<{ checkoutRequestId: string }> => api.post('/mpesa/stk-push', payload).then(res => res.data);
export const getMpesaPaymentStatus = (checkoutRequestId: string): Promise<{ status: string, sale?: Sale, message?: string }> => api.get(`/mpesa/status/${checkoutRequestId}`).then(res => res.data);
export const getMpesaTransactions = (page: number, limit: number, status: string): Promise<{ transactions: MpesaTransaction[], total: number }> => api.get('/mpesa/transactions', { params: { page, limit, status: status === 'All' ? undefined : status } }).then(res => res.data);
