

import { 
    ApplicationStatus, 
    BusinessApplication, 
    RegistrationData,
    Product, 
    Branch, 
    Customer, 
    Sale, 
    Invoice, 
    ShippingLabel, 
    ShippingStatus,
    NotificationPayload
} from '../types';

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
    // Add 1 day to the end date on the client-side to make the backend query inclusive and simpler (using < end date).
    const inclusiveEndDate = new Date(dateRange.end);
    inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
    url.searchParams.append('endDate', inclusiveEndDate.toISOString().split('T')[0]);
    return `${url.pathname}${url.search}`;
};

// --- AUTH ---
export const loginUser = async (email: string, pass: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
    });
    const { token } = await handleResponse<{ token: string }>(response);
    sessionStorage.setItem('authToken', token);
    return { success: true };
}

export const checkAuth = (): Promise<boolean> => {
    const token = sessionStorage.getItem('authToken');
    // In a real app, you might want to verify the token with the backend here.
    // For now, we'll just check for its existence.
    return Promise.resolve(!!token);
}

export const registerUser = async (data: RegistrationData) => {
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

// --- GENERAL DATA ---
export const getSales = async (dateRange?: DateRange): Promise<Sale[]> => {
    let url = `${API_BASE_URL}/data/sales`;
    if (dateRange) {
        url = buildUrlWithDateRange(url, dateRange);
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse<Sale[]>(response);
};

export const getInvoices = async (): Promise<Invoice[]> => {
    const response = await fetch(`${API_BASE_URL}/data/invoices`, { headers: getAuthHeaders() });
    return handleResponse<Invoice[]>(response);
};

export const getBranches = async (): Promise<Branch[]> => {
    const response = await fetch(`${API_BASE_URL}/data/branches`, { headers: getAuthHeaders() });
    return handleResponse<Branch[]>(response);
};

export const getCustomers = async (): Promise<Customer[]> => {
    const response = await fetch(`${API_BASE_URL}/data/customers`, { headers: getAuthHeaders() });
    return handleResponse<Customer[]>(response);
};

export const getShipments = getShippingLabels;

// --- DASHBOARD & REPORTS ---
export const getDashboardStats = async (dateRange: DateRange) => {
    const url = buildUrlWithDateRange(`${API_BASE_URL}/dashboard/stats`, dateRange);
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse<any>(response);
};

export const getSalesChartData = async (dateRange: DateRange) => {
    const url = buildUrlWithDateRange(`${API_BASE_URL}/dashboard/sales-chart`, dateRange);
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse<any[]>(response);
};

export const updateSalesTarget = async (target: number): Promise<{ salesTarget: number }> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/sales-target`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ target }),
    });
    return handleResponse<{ salesTarget: number }>(response);
};