import { 
    ApplicationStatus, 
    BusinessApplication, 
    RegistrationData,
    Product, 
    Branch, 
    Customer, 
    Sale, 
    Invoice,
    InvoiceStatus,
    Quotation,
    ShippingLabel, 
    ShippingStatus,
    NotificationPayload,
    User,
    AppSettings,
    DashboardStats,
    SalesChartDataPoint,
    VinSearchResult,
    SalePayload,
    QuotationPayload,
    MpesaPayload,
} from '@masuma-ea/types';

// This setup is for a single-server deployment model where the backend
// serves both the API and the frontend static files.
export const API_BASE_URL = '/api';
export const DOCS_BASE_URL = ''; // Docs are served from the same origin.

interface DateRange {
  start: string;
  end: string;
}

/**
 * A helper function to handle API responses.
 * It checks for errors and parses the JSON body.
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'An unknown API error occurred' }));
    throw new Error(errorData.message || 'Failed to fetch data');
  }
  return response.json() as Promise<T>;
};

/**
 * Creates the authorization headers if a token exists.
 */
const getAuthHeaders = (): HeadersInit => {
    const token = sessionStorage.getItem('authToken');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const buildUrlWithDateRange = (baseUrl: string, dateRange: DateRange): string => {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.append('startDate', dateRange.start);
    url.searchParams.append('endDate', dateRange.end);
    return `${url.pathname}${url.search}`;
};

// --- AUTH ---
export const loginUser = async (email: string, pass: string): Promise<{ token: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
    });
    return handleResponse<{ token: string }>(response);
}

export const loginWithGoogle = async (googleToken: string): Promise<{ token: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken }),
    });
    return handleResponse<{ token: string }>(response);
};

export const checkAuth = (): Promise<boolean> => {
    const token = sessionStorage.getItem('authToken');
    // In a real app, you might want to verify the token with the backend here.
    // For now, we'll just check for its existence.
    return Promise.resolve(!!token);
}

export const registerUser = async (data: RegistrationData): Promise<BusinessApplication> => {
    const formData = new FormData();
    formData.append('businessName', data.businessName);
    formData.append('kraPin', data.kraPin);
    formData.append('contactName', data.contactName);
    formData.append('contactEmail', data.contactEmail);
    formData.append('contactPhone', data.contactPhone);
    formData.append('password', data.password || '');
    formData.append('certOfInc', data.certOfInc);
    formData.append('cr12', data.cr12);

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        body: formData, // No Content-Type header needed, browser sets it for FormData
    });

    return handleResponse<BusinessApplication>(response);
}

// --- NOTIFICATIONS ---
export const getNotifications = async (lastCheck?: string): Promise<NotificationPayload> => {
    const url = new URL(`${API_BASE_URL}/notifications`, window.location.origin);
    if (lastCheck) {
        url.searchParams.append('lastCheck', lastCheck);
    }
    const response = await fetch(url.toString(), { headers: getAuthHeaders() });
    return handleResponse<NotificationPayload>(response);
};

// --- INVENTORY ---
export const getProducts = async (): Promise<Product[]> => {
    const response = await fetch(`${API_BASE_URL}/inventory/products`, { headers: getAuthHeaders() });
    return handleResponse<Product[]>(response);
};

export const createProduct = async (data: Omit<Product, 'id'>): Promise<Product> => {
    const response = await fetch(`${API_BASE_URL}/inventory/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<Product>(response);
};

export const updateProduct = async (id: string, data: Partial<Product>): Promise<Product> => {
    const response = await fetch(`${API_BASE_URL}/inventory/products/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<Product>(response);
};

export const importProducts = async (products: Omit<Product, 'id'>[]): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/inventory/products/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(products),
    });
    return handleResponse<{ message: string }>(response);
};

// --- B2B MANAGEMENT ---
export const getB2BApplications = async (): Promise<BusinessApplication[]> => {
    const response = await fetch(`${API_BASE_URL}/b2b/applications`, { headers: getAuthHeaders() });
    return handleResponse<BusinessApplication[]>(response);
};

export const updateB2BApplicationStatus = async (id: string, status: ApplicationStatus): Promise<BusinessApplication> => {
    const response = await fetch(`${API_BASE_URL}/b2b/applications/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
    });
    return handleResponse<BusinessApplication>(response);
}

// --- USER MANAGEMENT ---
export const getUsers = async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders() });
    return handleResponse<User[]>(response);
};

export const createUser = async (data: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<User>(response);
};

export const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<User>(response);
};

export const updateCurrentUserPassword = async (data: { currentPassword?: string; newPassword?: string; }): Promise<{ message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/users/me/password`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(response);
};


// --- POS ---
export const createSale = async (payload: SalePayload): Promise<Sale> => {
    const response = await fetch(`${API_BASE_URL}/pos/sales`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<Sale>(response);
};


// --- SHIPPING ---
export const getShippingLabels = async (dateRange?: DateRange): Promise<ShippingLabel[]> => {
    let url = `${API_BASE_URL}/shipping/labels`;
    if (dateRange) {
        url = buildUrlWithDateRange(url, dateRange);
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse<ShippingLabel[]>(response);
};

export const createShippingLabel = async (data: Partial<ShippingLabel>): Promise<ShippingLabel> => {
    const response = await fetch(`${API_BASE_URL}/shipping/labels`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<ShippingLabel>(response);
}

export const updateShippingLabelStatus = async (id: string, status: ShippingStatus): Promise<ShippingLabel> => {
    const response = await fetch(`${API_BASE_URL}/shipping/labels/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
    });
    return handleResponse<ShippingLabel>(response);
}

// --- QUOTATIONS & INVOICES ---
export const getQuotations = async (): Promise<Quotation[]> => {
    const response = await fetch(`${API_BASE_URL}/quotations`, { headers: getAuthHeaders() });
    return handleResponse<Quotation[]>(response);
};

export const getQuotationDetails = async (id: number): Promise<Quotation> => {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}`, { headers: getAuthHeaders() });
    return handleResponse<Quotation>(response);
};

export const createQuotation = async (payload: QuotationPayload): Promise<Quotation> => {
    const response = await fetch(`${API_BASE_URL}/quotations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    return handleResponse<Quotation>(response);
};

export const updateQuotationStatus = async (id: number, status: string): Promise<Quotation> => {
     const response = await fetch(`${API_BASE_URL}/quotations/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
    });
    return handleResponse<Quotation>(response);
};

export const convertQuotationToInvoice = async (id: number): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}/convert`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse<Invoice>(response);
};

export const getInvoices = async (status?: InvoiceStatus): Promise<Invoice[]> => {
    const url = new URL(`${API_BASE_URL}/invoices`, window.location.origin);
    if (status && status !== 'All' as any) {
        url.searchParams.append('status', status);
    }
    const response = await fetch(url.toString(), { headers: getAuthHeaders() });
    return handleResponse<Invoice[]>(response);
};

export const getInvoiceDetails = async (id: number): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}`, { headers: getAuthHeaders() });
    return handleResponse<Invoice>(response);
};


// --- GENERAL DATA ---
export const getSales = async (dateRange?: DateRange): Promise<Sale[]> => {
    let url = `${API_BASE_URL}/data/sales`;
    if (dateRange) {
        url = buildUrlWithDateRange(url, dateRange);
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse<Sale[]>(response);
};

// Returns a list of unpaid invoices with minimal data for dropdowns.
export const getUnpaidInvoiceSnippets = async (): Promise<Pick<Invoice, 'id'| 'invoice_no'>[]> => {
    const response = await fetch(`${API_BASE_URL}/data/invoices`, { headers: getAuthHeaders() });
    return handleResponse<Pick<Invoice, 'id'| 'invoice_no'>[]>(response);
};

export const getBranches = async (): Promise<Branch[]> => {
    const response = await fetch(`${API_BASE_URL}/data/branches`, { headers: getAuthHeaders() });
    return handleResponse<Branch[]>(response);
};

export const getCustomers = async (): Promise<Customer[]> => {
    const response = await fetch(`${API_BASE_URL}/data/customers`, { headers: getAuthHeaders() });
    return handleResponse<Customer[]>(response);
};

export const createCustomer = async (data: Omit<Customer, 'id'>): Promise<Customer> => {
    const response = await fetch(`${API_BASE_URL}/data/customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<Customer>(response);
};

export const getShipments = getShippingLabels;

// --- SETTINGS ---
export const getSettings = async (): Promise<AppSettings> => {
    const response = await fetch(`${API_BASE_URL}/settings`, { headers: getAuthHeaders() });
    return handleResponse<AppSettings>(response);
};

export const updateSettings = async (data: AppSettings): Promise<AppSettings> => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<AppSettings>(response);
};


// --- DASHBOARD & REPORTS ---
export const getDashboardStats = async (dateRange: DateRange): Promise<DashboardStats> => {
    const url = buildUrlWithDateRange(`${API_BASE_URL}/dashboard/stats`, dateRange);
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse<DashboardStats>(response);
};

export const getSalesChartData = async (dateRange: DateRange): Promise<SalesChartDataPoint[]> => {
    const url = buildUrlWithDateRange(`${API_BASE_URL}/dashboard/sales-chart`, dateRange);
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse<SalesChartDataPoint[]>(response);
};

export const updateSalesTarget = async (target: number): Promise<{ salesTarget: number }> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/sales-target`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ target }),
    });
    return handleResponse<{ salesTarget: number }>(response);
};

// --- VIN PICKER ---
export const getPartsByVin = async (vin: string): Promise<VinSearchResult[]> => {
    const response = await fetch(`${API_BASE_URL}/vin-picker/${vin}`, { headers: getAuthHeaders() });
    return handleResponse<VinSearchResult[]>(response);
};

// --- M-PESA PAYMENTS ---
export const initiateMpesaPayment = async (payload: MpesaPayload): Promise<{ checkoutRequestId: string }> => {
    const response = await fetch(`${API_BASE_URL}/payments/mpesa/initiate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<{ checkoutRequestId: string }>(response);
};

export const getMpesaPaymentStatus = async (checkoutRequestId: string): Promise<{ status: string, sale?: Sale, message?: string }> => {
    const response = await fetch(`${API_BASE_URL}/payments/mpesa/status/${checkoutRequestId}`, { headers: getAuthHeaders() });
    return handleResponse<{ status: string, sale?: Sale, message?: string }>(response);
};
