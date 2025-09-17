import { 
    User, 
    Product, 
    BusinessApplication, 
    DashboardStats, 
    SalesChartDataPoint,
    FastMovingProduct,
    VinSearchResult,
    Sale,
    SaleItem,
    Invoice,
    Quotation,
    ShippingLabel,
    Customer,
    Branch,
    AppSettings,
    CustomerTransactions,
    QuotationPayload,
    StockRequest,
    CreateStockRequestPayload,
    AuditLog,
    MpesaTransaction,
    NotificationPayload,
    MpesaTransactionPayload,
} from '@masuma-ea/types';


// --- TYPES ---

export interface LoginResponse {
    user: User;
}

export interface RegisterPayload extends Omit<BusinessApplication, 'id' | 'status' | 'submittedAt' | 'certOfIncUrl' | 'cr12Url'> {
    password?: string;
    certOfInc: File;
    cr12: File;
}

export interface UpdatePasswordPayload {
    currentPassword?: string;
    newPassword: string;
}

export interface BulkImportResponse {
    successCount: number;
    errorCount: number;
    errors: string[];
}


// --- API HELPER ---
const apiRequest = async <T>(method: string, endpoint: string, body?: any, isFormData = false): Promise<T> => {
    const options: RequestInit = {
        method,
        credentials: 'include', // For HttpOnly session cookies
    };

    if (body) {
        if (isFormData) {
            options.body = body; // Let browser set Content-Type for FormData
        } else {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }
    }

    const response = await fetch(`/api${endpoint}`, options);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));
        throw new Error(errorData.message || 'An unknown network error occurred');
    }

    if (response.status === 204) { // No Content
        return undefined as T;
    }

    return response.json();
};

// --- AUTH ---
export const login = (email: string, password: string): Promise<LoginResponse> => 
    apiRequest('POST', '/auth/login', { email, password });
    
export const loginWithGoogle = (token: string): Promise<LoginResponse> =>
    apiRequest('POST', '/auth/login-google', { token });

export const logoutUser = (): Promise<void> => 
    apiRequest('POST', '/auth/logout');

export const verifyAuth = (): Promise<User> => 
    apiRequest('GET', '/auth/verify');

export const registerUser = (payload: RegisterPayload): Promise<BusinessApplication> => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, value);
    });
    return apiRequest('POST', '/b2b/register', formData, true);
};


// --- PRODUCTS ---
export const getProducts = (params?: { page?: number, limit?: number, searchTerm?: string }): Promise<{ products: Product[], total: number }> => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest('GET', `/products?${query}`);
}

export const createProduct = (productData: Partial<Product>): Promise<Product> =>
    apiRequest('POST', '/products', productData);

export const updateProduct = (id: string, productData: Partial<Product>): Promise<Product> =>
    apiRequest('PUT', `/products/${id}`, productData);

export const bulkImportProducts = (file: File): Promise<BulkImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('POST', '/products/bulk-import', formData, true);
};


// --- CUSTOMERS ---
export const getCustomers = (params?: { page?: number, limit?: number, searchTerm?: string, spendingFilter?: string, recencyFilter?: string, sortKey?: string, sortDirection?: string }): Promise<{ customers: any[], total: number }> => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest('GET', `/customers?${query}`);
};

export const createCustomer = (customerData: Omit<Customer, 'id'>): Promise<Customer> =>
    apiRequest('POST', '/customers', customerData);
    
export const getCustomerTransactions = (customerId: number): Promise<CustomerTransactions> =>
    apiRequest('GET', `/customers/${customerId}/transactions`);


// --- DASHBOARD & REPORTS ---
export const getDashboardStats = (dateRange: { start: string, end: string }, branchId: number): Promise<DashboardStats> =>
    apiRequest('GET', `/reports/dashboard-stats?start=${dateRange.start}&end=${dateRange.end}&branchId=${branchId}`);
    
export const updateSalesTarget = (salesTarget: number): Promise<{ salesTarget: number }> =>
    apiRequest('POST', '/reports/sales-target', { salesTarget });
    
export const getSalesChartData = (dateRange: { start: string, end: string }, branchId: number): Promise<SalesChartDataPoint[]> =>
    apiRequest('GET', `/reports/sales-chart?start=${dateRange.start}&end=${dateRange.end}&branchId=${branchId}`);
    
export const getFastMovingProducts = (dateRange: { start: string, end: string }, branchId: number): Promise<FastMovingProduct[]> =>
    apiRequest('GET', `/reports/fast-moving-products?start=${dateRange.start}&end=${dateRange.end}&branchId=${branchId}`);
    
export const getShipments = (dateRange: { start: string, end: string }): Promise<ShippingLabel[]> =>
     apiRequest('GET', `/reports/shipments?start=${dateRange.start}&end=${dateRange.end}`);

// --- VIN SEARCH ---
export const getPartsByVin = (vin: string): Promise<VinSearchResult[]> =>
    apiRequest('POST', '/vin-search', { vin });
    
// --- SALES / POS ---
export const createSale = (saleData: any): Promise<Sale> => 
    apiRequest('POST', '/sales', saleData);
    
export const getSales = (params?: any): Promise<{ sales: Sale[], total: number } | Sale[]> => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest('GET', `/sales?${query}`);
};

export const getSaleDetails = (id: number): Promise<Sale> =>
    apiRequest('GET', `/sales/${id}`);


// --- INVOICES ---
export const getInvoices = (status?: string): Promise<Invoice[]> =>
    apiRequest('GET', `/invoices${status ? `?status=${status}`: ''}`);

export const getInvoiceDetails = (id: number): Promise<Invoice> =>
    apiRequest('GET', `/invoices/${id}`);
    
export const getUnpaidInvoiceSnippets = (): Promise<Pick<Invoice, 'id' | 'invoiceNo'>[]> =>
    apiRequest('GET', '/invoices/unpaid-snippets');

// --- QUOTATIONS ---
export const getQuotations = (): Promise<Quotation[]> => 
    apiRequest('GET', '/quotations');

export const createQuotation = (payload: QuotationPayload): Promise<Quotation> =>
    apiRequest('POST', '/quotations', payload);

export const getQuotationDetails = (id: number): Promise<Quotation> =>
    apiRequest('GET', `/quotations/${id}`);

export const updateQuotationStatus = (id: number, status: string): Promise<Quotation> =>
    apiRequest('PATCH', `/quotations/${id}/status`, { status });
    
export const convertQuotationToInvoice = (id: number): Promise<Invoice> =>
    apiRequest('POST', `/quotations/${id}/to-invoice`);
    
// --- SHIPPING ---
export const getShippingLabels = (): Promise<ShippingLabel[]> =>
    apiRequest('GET', '/shipping-labels');

export const createShippingLabel = (labelData: Partial<ShippingLabel>): Promise<ShippingLabel> =>
    apiRequest('POST', '/shipping-labels', labelData);
    
export const updateShippingLabelStatus = (id: string, status: string): Promise<ShippingLabel> =>
    apiRequest('PATCH', `/shipping-labels/${id}/status`, { status });

// --- B2B Management ---
export const getB2BApplications = (): Promise<BusinessApplication[]> =>
    apiRequest('GET', '/b2b/applications');

export const updateB2BApplicationStatus = (id: string, status: string): Promise<BusinessApplication> =>
    apiRequest('PATCH', `/b2b/applications/${id}/status`, { status });

// --- Stock Requests ---
export const getMyStockRequests = (): Promise<StockRequest[]> =>
    apiRequest('GET', '/stock-requests/my');
    
export const getAllStockRequests = (): Promise<StockRequest[]> =>
    apiRequest('GET', '/stock-requests/all');
    
export const getStockRequestDetails = (id: number): Promise<StockRequest> =>
    apiRequest('GET', `/stock-requests/${id}`);

export const createStockRequest = (payload: CreateStockRequestPayload): Promise<StockRequest> =>
    apiRequest('POST', '/stock-requests', payload);

export const updateStockRequestStatus = (id: number, status: string): Promise<StockRequest> =>
    apiRequest('PATCH', `/stock-requests/${id}/status`, { status });

// --- USERS & BRANCHES ---
export const getUsers = (): Promise<User[]> =>
    apiRequest('GET', '/users');
    
export const createUser = (userData: Partial<User & {password: string}>): Promise<User> =>
    apiRequest('POST', '/users', userData);
    
export const updateUser = (id: string, userData: Partial<User>): Promise<User> =>
    apiRequest('PUT', `/users/${id}`, userData);
    
export const updateCurrentUserPassword = (payload: UpdatePasswordPayload): Promise<void> =>
    apiRequest('PUT', '/users/me/password', payload);
    
export const getBranches = (): Promise<Branch[]> =>
    apiRequest('GET', '/branches');
    
export const createBranch = (branchData: Omit<Branch, 'id'>): Promise<Branch> =>
    apiRequest('POST', '/branches', branchData);
    
export const updateBranch = (id: number, branchData: Partial<Branch>): Promise<Branch> =>
    apiRequest('PUT', `/branches/${id}`, branchData);

// --- SETTINGS ---
export const getSettings = (): Promise<Partial<AppSettings>> =>
    apiRequest('GET', '/settings');
    
export const updateSettings = (settings: AppSettings): Promise<AppSettings> =>
    apiRequest('PUT', '/settings', settings);

// --- AUDIT LOGS ---
export const getAuditLogs = (page: number, limit: number): Promise<{ logs: AuditLog[], total: number }> =>
    apiRequest('GET', `/audit-logs?page=${page}&limit=${limit}`);

// --- MPESA ---
export const getMpesaTransactions = (page: number, limit: number, status: string): Promise<{ transactions: MpesaTransaction[], total: number }> =>
    apiRequest('GET', `/mpesa/transactions?page=${page}&limit=${limit}&status=${status}`);
    
export const initiateMpesaPayment = (payload: MpesaTransactionPayload & { amount: number, phoneNumber: string }): Promise<{ checkoutRequestId: string }> =>
    apiRequest('POST', '/mpesa/stk-push', payload);
    
export const getMpesaPaymentStatus = (checkoutRequestId: string): Promise<{ status: string, sale?: Sale, message?: string }> =>
    apiRequest('GET', `/mpesa/payment-status/${checkoutRequestId}`);

// --- NOTIFICATIONS ---
export const getNotifications = (): Promise<NotificationPayload> =>
    apiRequest('GET', '/notifications');

export const markNotificationsRead = (ids: number[]): Promise<void> =>
    apiRequest('POST', '/notifications/mark-read', { ids });