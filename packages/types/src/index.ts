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
  customerId?: number;
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
  saleId: number;
  productId: string;
  partNumber?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: number;
  saleNo: string;
  customerId: number;
  branchId: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string; // ISO date string
  items?: SaleItem[] | number;
  customer?: Partial<Customer>;
  branch?: Partial<Branch>;
}

export interface QuotationItem {
  id: number;
  quotationId: number;
  productId: string;
  partNumber?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
}

export interface Quotation {
  id: number;
  quotationNo: string;
  customerId: number;
  branchId: number;
  validUntil: string; // ISO date string
  totalAmount: number;
  status: QuotationStatus;
  createdAt: string; // ISO date string
  customerName?: string;
  items?: QuotationItem[];
  customer?: Partial<Customer>;
  branch?: Partial<Branch>;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: string;
  partNumber?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  customerId: number;
  branchId: number;
  quotationId?: number;
  dueDate: string; // ISO date string
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  createdAt: string; // ISO date string
  customerName?: string;
  items?: InvoiceItem[];
  customer?: Partial<Customer>;
  branch?: Partial<Branch>;
}

export interface ShippingLabel {
  id: string; // uuid
  saleId?: number;
  invoiceId?: number;
  fromBranchId: number;
  toCustomerId: number;
  fromName: string;
  fromAddress: string;
  fromPhone: string;
  toName: string;
  toAddress: string;
  toPhone: string;
  weight?: number;
  carrier?: string;
  status: ShippingStatus;
  createdAt: string; // ISO date string
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
  mpesaEnvironment?: 'sandbox' | 'live';
}

export interface StockRequestItem {
    id: number;
    stockRequestId: number;
    productId: string;
    quantity: number;
    wholesalePriceAtRequest: number;
}

export interface StockRequest {
    id: number;
    b2bUserId: string;
    branchId: number;
    status: StockRequestStatus;
    createdAt: string; // ISO date string
    items?: StockRequestItem[];
    itemCount?: number;
    totalValue?: number;
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
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPayload {
  serverTimestamp: string;
  newApplications: { id: string; businessName: string }[];
  lowStockProducts: { id:string; name: string; stock: number }[]; // This remains for the dashboard widget
  userAlerts?: UserNotification[]; // For real-time, user-specific toast notifications
}

export interface AuditLog {
  id: number;
  userId: string;
  userName?: string;
  action: string;
  details: any;
  createdAt: string;
}

// --- M-PESA TYPES ---

export interface MpesaTransaction {
  id: number;
  checkoutRequestId: string;
  amount: number;
  phoneNumber: string;
  status: 'Pending' | 'Completed' | 'Failed';
  resultDesc: string;
  mpesaReceiptNumber?: string;
  createdAt: string;
  saleNo?: string;
  invoiceNo?: string;
}

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