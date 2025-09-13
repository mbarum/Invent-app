// --- ENUMS ---

export enum UserRole {
  SYSTEM_ADMINISTRATOR = 'System Administrator',
  BRANCH_MANAGER = 'Branch Manager',
  SALES_STAFF = 'Sales Staff',
  INVENTORY_MANAGER = 'Inventory Manager',
  B2B_CLIENT = 'B2B Client',
}

export enum ApplicationStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum StockRequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  SHIPPED = 'Shipped',
}

export enum ShippingStatus {
  DRAFT = 'Draft',
  PRINTED = 'Printed',
  SHIPPED = 'Shipped',
}

export enum QuotationStatus {
  DRAFT = 'Draft',
  SENT = 'Sent',
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  INVOICED = 'Invoiced',
  EXPIRED = 'Expired',
}

export enum InvoiceStatus {
  UNPAID = 'Unpaid',
  PAID = 'Paid',
  VOID = 'Void',
}


// --- DATA MODELS ---

export interface Product {
  id: string; // uuid
  partNumber: string;
  oemNumbers?: string[];
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  notes?: string;
}

export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
}

export interface Customer {
  id: number;
  name: string;
  address: string;
  phone: string;
  kraPin?: string;
}

export interface User {
  id: string; // uuid
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  businessId?: string;
  businessName?: string;
  customer_id?: number;
}

export interface BusinessApplication {
  id:string; // uuid
  businessName: string;
  kraPin: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  certOfIncUrl: string;
  cr12Url: string;
  status: ApplicationStatus;
  submittedAt: string; // ISO date string
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: string;
  part_number?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

export interface Sale {
  id: number;
  sale_no: string;
  customer_id: number;
  branch_id: number;
  tax_amount?: number;
  discount_amount?: number;
  totalAmount: number;
  payment_method: string;
  created_at: string; // ISO date string
  items?: SaleItem[] | number;
  customer?: Partial<Customer>;
  branch?: Partial<Branch>;
}

export interface QuotationItem {
  id: number;
  quotation_id: number;
  product_id: string;
  part_number?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

export interface Quotation {
  id: number;
  quotation_no: string;
  customer_id: number;
  branch_id: number;
  valid_until: string; // ISO date string
  totalAmount: number;
  status: QuotationStatus;
  created_at: string; // ISO date string
  customerName?: string;
  items?: QuotationItem[];
  customer?: Partial<Customer>;
  branch?: Partial<Branch>;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  product_id: string;
  part_number?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  customer_id: number;
  branch_id: number;
  quotation_id?: number;
  due_date: string; // ISO date string
  totalAmount: number;
  amount_paid: number;
  status: InvoiceStatus;
  created_at: string; // ISO date string
  customerName?: string;
  items?: InvoiceItem[];
  customer?: Partial<Customer>;
  branch?: Partial<Branch>;
}

export interface ShippingLabel {
  id: string; // uuid
  sale_id?: number;
  invoice_id?: number;
  from_branch_id: number;
  to_customer_id: number;
  from_name: string;
  from_address: string;
  from_phone: string;
  to_name: string;
  to_address: string;
  to_phone: string;
  weight?: number;
  carrier?: string;
  status: ShippingStatus;
  created_at: string; // ISO date string
}

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyKraPin: string;
  taxRate: number;
  invoiceDueDays: number;
  lowStockThreshold: number;
  mpesaPaybill?: string;
  mpesaConsumerKey?: string;
  mpesaConsumerSecret?: string;
  mpesaPasskey?: string;
  paymentDetails?: string;
  paymentTerms?: string;
}

export interface StockRequestItem {
    id: number;
    stock_request_id: number;
    product_id: string;
    quantity: number;
    wholesale_price_at_request: number;
}

export interface StockRequest {
    id: number;
    b2b_user_id: string;
    branch_id: number;
    status: StockRequestStatus;
    created_at: string; // ISO date string
    items?: StockRequestItem[];
}


// --- API-SPECIFIC TYPES ---

export interface DashboardStats {
  totalRevenue: number;
  totalSales: number;
  activeCustomers: number;
  totalShipments: number;
  pendingShipments: number;
  salesTarget: number;
}

export interface SalesChartDataPoint {
  name: string; // date
  sales: number;
  revenue: number;
}

export interface FastMovingProduct {
  id: string;
  name: string;
  totalSold: number;
  currentStock: number;
}

export interface VinSearchResult {
  partNumber: string;
  name: string;
  compatibility: string;
  stock: number;
}

export interface CustomerTransactions {
    sales: Sale[];
    invoices: Invoice[];
    quotations: Quotation[];
}

export interface QuotationPayload {
    customerId: number;
    branchId: number;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
    }[];
    validUntil: string;
}

export interface CreateStockRequestPayload {
    branchId: number;
    items: {
        productId: string;
        quantity: number;
    }[];
}

export interface UserNotification {
  id: number;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPayload {
  serverTimestamp: string;
  newApplications: { id: string; businessName: string }[];
  lowStockProducts: { id:string; name: string; stock: number }[]; // This remains for the dashboard widget
  userAlerts?: UserNotification[]; // For real-time, user-specific toast notifications
}

export interface AuditLog {
  id: number;
  user_id: string;
  userName?: string;
  action: string;
  details: any;
  created_at: string;
}

// --- M-PESA TYPES ---

export interface MpesaCartItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

export interface MpesaTransactionPayload {
    customerId: number;
    branchId: number;
    items: MpesaCartItem[];
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: string;
    invoiceId?: number;
}
