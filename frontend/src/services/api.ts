import {
  User, LoginResponse, Product, Branch, Customer, Sale, ShippingLabel,
  Quotation, QuotationPayload, Invoice, AppSettings, BusinessApplication,
  BulkImportResponse, UserNotification, AuditLog, StockRequest,
  MpesaTransaction, VinSearchResult, CustomerTransactions, StockRequestStatus, QuotationStatus, ShippingStatus, InvoiceStatus, CreateStockRequestPayload
} from '@masuma-ea/types';


const API_BASE_URL = '/api';

// A helper to handle API responses and errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    // For "No Content" responses
    return Promise.resolve(undefined as T);
  }
  const data = await response.json();
  if (!response.ok) {
    const message = data.message || `An error occurred: ${response.statusText}`;
    throw new Error(message);
  }
  return data as T;
}


// --- Auth ---

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<LoginResponse>(response);
}

export async function loginWithGoogle(token: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });
    return handleResponse<LoginResponse>(response);
}

export async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
}

export async function verifyAuth(): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/verify`);
  return handleResponse<User>(response);
}

export async function registerUser(payload: {
  businessName: string;
  kraPin: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  password: string;
  certOfInc: File;
  cr12: File;
}): Promise<BusinessApplication> {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, value);
  });
  
  const response = await fetch(`${API_BASE_URL}/b2b/register`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<BusinessApplication>(response);
}

// --- Products ---
interface GetProductsParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  outOfStock?: boolean;
}

export async function getProducts(params: GetProductsParams = {}): Promise<{ products: Product[], total: number }> {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_BASE_URL}/products?${query}`);
    return handleResponse<{ products: Product[], total: number }>(response);
}

export async function createProduct(product: Partial<Product>): Promise<Product> {
    const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
    });
    return handleResponse<Product>(response);
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
    });
    return handleResponse<Product>(response);
}

export async function bulkImportProducts(file: File): Promise<BulkImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/products/bulk-import`, {
        method: 'POST',
        body: formData,
    });
    return handleResponse<BulkImportResponse>(response);
}

// --- Customers ---
export async function getCustomers(params: any = {}): Promise<{ customers: Customer[], total: number }> {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/customers?${query}`, { cache: 'no-store' });
    return handleResponse<{ customers: Customer[], total: number }>(response);
}

export async function createCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer),
    });
    return handleResponse<Customer>(response);
}

export async function updateCustomer(id: number, customer: Partial<Customer>): Promise<Customer> {
    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer),
    });
    return handleResponse<Customer>(response);
}

export async function getCustomerTransactions(id: number): Promise<CustomerTransactions> {
    const response = await fetch(`${API_BASE_URL}/customers/${id}/transactions`);
    return handleResponse<CustomerTransactions>(response);
}


// --- Sales / POS ---
export async function createSale(saleData: any): Promise<Sale> {
    const response = await fetch(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
    });
    return handleResponse<Sale>(response);
}

export async function getSales(params: any = {}): Promise<{ sales: Sale[], total: number } | Sale[]> {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/sales?${query}`);
    return handleResponse<{ sales: Sale[], total: number } | Sale[]>(response);
}

export async function getSaleDetails(id: number): Promise<Sale> {
    const response = await fetch(`${API_BASE_URL}/sales/${id}`);
    return handleResponse<Sale>(response);
}

// --- M-Pesa ---
export async function initiateMpesaPayment(payload: any): Promise<{ checkoutRequestId: string }> {
    const response = await fetch(`${API_BASE_URL}/mpesa/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse<{ checkoutRequestId: string }>(response);
}

export async function getMpesaPaymentStatus(checkoutId: string): Promise<{ status: string, sale?: Sale, message?: string }> {
    const response = await fetch(`${API_BASE_URL}/mpesa/status/${checkoutId}`);
    return handleResponse<{ status: string, sale?: Sale, message?: string }>(response);
}

// --- Shipping ---
export async function getShippingLabels(): Promise<ShippingLabel[]> {
    const response = await fetch(`${API_BASE_URL}/shipping-labels`);
    return handleResponse<ShippingLabel[]>(response);
}

export async function createShippingLabel(data: Partial<ShippingLabel>): Promise<ShippingLabel> {
    const response = await fetch(`${API_BASE_URL}/shipping-labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse<ShippingLabel>(response);
}

export async function updateShippingLabelStatus(id: string, status: ShippingStatus): Promise<ShippingLabel> {
    const response = await fetch(`${API_BASE_URL}/shipping-labels/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    return handleResponse<ShippingLabel>(response);
}

// --- Quotations & Invoices ---
export async function getQuotations(): Promise<Quotation[]> {
    const response = await fetch(`${API_BASE_URL}/quotations`);
    return handleResponse<Quotation[]>(response);
}

export async function getQuotationDetails(id: number): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}`);
    return handleResponse<Quotation>(response);
}

export async function createQuotation(payload: QuotationPayload): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse<Quotation>(response);
}

export async function updateQuotation(id: number, payload: QuotationPayload): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse<Quotation>(response);
}

export async function updateQuotationStatus(id: number, status: QuotationStatus): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    return handleResponse<Quotation>(response);
}

export async function convertQuotationToInvoice(id: number): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}/to-invoice`, { method: 'POST' });
    return handleResponse<Invoice>(response);
}

export async function getInvoices(status?: InvoiceStatus): Promise<Invoice[]> {
    const url = status ? `${API_BASE_URL}/invoices?status=${status}` : `${API_BASE_URL}/invoices`;
    const response = await fetch(url);
    return handleResponse<Invoice[]>(response);
}

export async function getInvoiceDetails(id: number): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}`);
    return handleResponse<Invoice>(response);
}

export async function getUnpaidInvoiceSnippets(): Promise<Pick<Invoice, 'id' | 'invoiceNo'>[]> {
    const response = await fetch(`${API_BASE_URL}/invoices/unpaid-snippets`);
    return handleResponse<Pick<Invoice, 'id' | 'invoiceNo'>[]>(response);
}

// --- General Data ---
export async function getBranches(): Promise<Branch[]> {
    const response = await fetch(`${API_BASE_URL}/branches`);
    return handleResponse<Branch[]>(response);
}

export async function createBranch(branch: Omit<Branch, 'id'>): Promise<Branch> {
    const response = await fetch(`${API_BASE_URL}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branch),
    });
    return handleResponse<Branch>(response);
}

export async function updateBranch(id: number, branch: Partial<Branch>): Promise<Branch> {
    const response = await fetch(`${API_BASE_URL}/branches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branch),
    });
    return handleResponse<Branch>(response);
}

// --- Reports & Stats ---
export async function getDashboardStats(range: {start: string, end: string}, branchId: number): Promise<any> {
    const query = new URLSearchParams({ ...range, branchId: String(branchId) }).toString();
    const response = await fetch(`${API_BASE_URL}/reports/dashboard-stats?${query}`);
    return handleResponse<any>(response);
}

export async function updateSalesTarget(salesTarget: number): Promise<{ salesTarget: number }> {
    const response = await fetch(`${API_BASE_URL}/reports/sales-target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesTarget }),
    });
    return handleResponse<{ salesTarget: number }>(response);
}

export async function getSalesChartData(range: {start: string, end: string}, branchId: number): Promise<any> {
    const query = new URLSearchParams({ ...range, branchId: String(branchId) }).toString();
    const response = await fetch(`${API_BASE_URL}/reports/sales-chart?${query}`);
    return handleResponse<any>(response);
}

export async function getFastMovingProducts(range: {start: string, end: string}, branchId: number): Promise<any> {
    const query = new URLSearchParams({ ...range, branchId: String(branchId) }).toString();
    const response = await fetch(`${API_BASE_URL}/reports/fast-moving-products?${query}`);
    return handleResponse<any>(response);
}

export async function getShipments(range: {start: string, end: string}): Promise<ShippingLabel[]> {
    const query = new URLSearchParams(range).toString();
    const response = await fetch(`${API_BASE_URL}/reports/shipments?${query}`);
    return handleResponse<ShippingLabel[]>(response);
}


// --- Admin / Settings ---
export async function getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/users`);
    return handleResponse<User[]>(response);
}

export async function createUser(user: Partial<User>): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });
    return handleResponse<User>(response);
}

export async function updateUser(id: string, user: Partial<User>): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });
    return handleResponse<User>(response);
}

export async function updateCurrentUserPassword(data: { currentPassword?: string, newPassword?: string }): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/users/me/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    await handleResponse(response);
}

export async function getSettings(): Promise<Partial<AppSettings>> {
    const response = await fetch(`${API_BASE_URL}/settings`);
    return handleResponse<Partial<AppSettings>>(response);
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    return handleResponse<AppSettings>(response);
}

// --- B2B ---
export async function getB2BApplications(): Promise<BusinessApplication[]> {
    const response = await fetch(`${API_BASE_URL}/b2b/applications`);
    return handleResponse<BusinessApplication[]>(response);
}

export async function updateB2BApplicationStatus(id: string, status: 'Approved' | 'Rejected'): Promise<BusinessApplication> {
    const response = await fetch(`${API_BASE_URL}/b2b/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    return handleResponse<BusinessApplication>(response);
}

export async function createStockRequest(payload: CreateStockRequestPayload): Promise<StockRequest> {
    const response = await fetch(`${API_BASE_URL}/stock-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse<StockRequest>(response);
}

export async function getMyStockRequests(): Promise<StockRequest[]> {
    const response = await fetch(`${API_BASE_URL}/stock-requests/my`);
    return handleResponse<StockRequest[]>(response);
}

export async function getAllStockRequests(): Promise<StockRequest[]> {
    const response = await fetch(`${API_BASE_URL}/stock-requests/all`);
    return handleResponse<StockRequest[]>(response);
}

export async function getStockRequestDetails(id: number): Promise<StockRequest> {
    const response = await fetch(`${API_BASE_URL}/stock-requests/${id}`);
    return handleResponse<StockRequest>(response);
}

export async function approveStockRequest(id: number, items: { itemId: number, approvedQuantity: number }[]): Promise<StockRequest> {
    const response = await fetch(`${API_BASE_URL}/stock-requests/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
    return handleResponse<StockRequest>(response);
}

export async function initiateStockRequestPayment(id: number, phoneNumber: string, amount: number): Promise<{ checkoutRequestId: string }> {
    const response = await fetch(`${API_BASE_URL}/mpesa/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockRequestId: id, phoneNumber, amount }),
    });
    return handleResponse<{ checkoutRequestId: string }>(response);
}

export async function updateStockRequestStatus(id: number, status: StockRequestStatus): Promise<StockRequest> {
    const response = await fetch(`${API_BASE_URL}/stock-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    return handleResponse<StockRequest>(response);
}

// --- VIN Search ---
export async function getPartsByVin(vin: string): Promise<VinSearchResult[]> {
    const response = await fetch(`${API_BASE_URL}/vin-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin }),
    });
    return handleResponse<VinSearchResult[]>(response);
}

// --- Audit Logs & Notifications ---
export async function getAuditLogs(page: number, limit: number): Promise<{ logs: AuditLog[], total: number }> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
    const response = await fetch(`${API_BASE_URL}/audit-logs?${query}`);
    return handleResponse<{ logs: AuditLog[], total: number }>(response);
}

export async function getNotifications(): Promise<{ userAlerts: UserNotification[] }> {
    const response = await fetch(`${API_BASE_URL}/notifications`);
    return handleResponse<{ userAlerts: UserNotification[] }>(response);
}

export async function markNotificationsRead(ids: number[]): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });
    await handleResponse(response);
}

export async function getMpesaTransactions(page: number, limit: number, status: string): Promise<{ transactions: MpesaTransaction[], total: number }> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit), status }).toString();
    const response = await fetch(`${API_BASE_URL}/mpesa/transactions?${query}`);
    return handleResponse<{ transactions: MpesaTransaction[], total: number }>(response);
}