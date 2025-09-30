// Enums
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
    PAID = 'Paid',
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
  INVOICED = 'Invoiced',
  REJECTED = 'Rejected',
  EXPIRED = 'Expired',
}

export enum InvoiceStatus {
  UNPAID = 'Unpaid',
  PAID = 'Paid',
  VOID = 'Void',
}

// Interfaces
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  b2bApplicationId?: string;
  customerId?: number;
  createdAt: string;
  updatedAt: string;
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
  lastPurchaseDate?: string | null; // From customer segmentation query
  totalSpending?: number; // From customer segmentation query
  totalOrders?: number; // From customer segmentation query
}

export interface Product {
  id: string;
  partNumber: string;
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  oemNumbers?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: string;
  quantity: number;
  unitPrice: number;
  // Joined properties
  productName?: string;
  partNumber?: string;
}

export interface Sale {
  id: number;
  saleNo: string;
  customerId: number;
  branchId: number;
  discountAmount?: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  invoiceId?: number | null;
  createdAt: string;
  updatedAt: string;
  // Joined properties
  customer?: Customer;
  branch?: Branch;
  items?: SaleItem[];
  customerName?: string;
  branchName?: string;
  itemCount?: number;
}

export interface QuotationItem {
  id: number;
  quotationId: number;
  productId: string;
  quantity: number;
  unitPrice: number;
  // Joined
  partNumber?: string;
  productName?: string;
}

export interface Quotation {
    id: number;
    quotationNo: string;
    customerId: number;
    branchId: number;
    validUntil: string;
    subtotal?: number;
    discountAmount?: number;
    taxAmount?: number;
    totalAmount: number;
    status: QuotationStatus;
    createdAt: string;
    updatedAt: string;
    // Joined
    customerName?: string;
    items?: QuotationItem[];
    customer?: Customer;
    branch?: Branch;
}

export interface InvoiceItem {
    id: number;
    invoiceId: number;
    productId: string;
    quantity: number;
    unitPrice: number;
    // Joined
    partNumber?: string;
    productName?: string;
}

export interface Invoice {
    id: number;
    invoiceNo: string;
    customerId: number;
    branchId: number;
    quotationId?: number | null;
    dueDate: string;
    totalAmount: number;
    amountPaid: number;
    status: InvoiceStatus;
    createdAt: string;
    updatedAt: string;
    // Joined
    customerName?: string;
    items?: InvoiceItem[];
    customer?: Customer;
    branch?: Branch;
}

export interface ShippingLabel {
    id: string;
    saleId?: number | null;
    invoiceId?: number | null;
    fromBranchId: number;
    toCustomerId: number;
    fromName: string;
    fromAddress: string;
    fromPhone: string;
    toName: string;
    toAddress: string;
    toPhone: string;
    weight?: number | null;
    carrier?: string | null;
    status: ShippingStatus;
    createdAt: string;
    updatedAt: string;
}

export interface AppSettings {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyKraPin: string;
    taxRate: number;
    invoiceDueDays: number;
    lowStockThreshold: number;
    mpesaPaybill: string;
    mpesaConsumerKey: string;
    mpesaConsumerSecret: string;
    mpesaPasskey: string;
    mpesaEnvironment: 'sandbox' | 'live';
    mpesaTransactionType: 'PayBill' | 'BuyGoods';
    paymentDetails: string;
    paymentTerms: string;
    salesTarget: number;
}

export interface UserNotification {
    id: number;
    userId: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: string;
}

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

export interface BulkImportResponse {
    successCount: number;
    errorCount: number;
    errors: string[];
}

export interface CustomerTransactions {
    sales: Sale[];
    invoices: Invoice[];
    quotations: Quotation[];
}

export interface QuotationPayload {
    customerId: number;
    branchId: number;
    items: { productId: string; quantity: number; unitPrice: number }[];
    validUntil: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
}

export interface VinSearchResult {
    partNumber: string;
    name: string;
    compatibility: string;
    stock: number;
}

export interface BusinessApplication {
    id: string;
    businessName: string;
    kraPin: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    certOfIncUrl: string;
    cr12Url: string;
    status: ApplicationStatus;
    submittedAt: string;
}

export interface StockRequestItem {
    id: number;
    stockRequestId: number;
    productId: string;
    quantity: number;
    approvedQuantity?: number | null;
    wholesalePriceAtRequest: number;
    // Joined
    partNumber?: string;
    productName?: string;
}

export interface StockRequest {
    id: number;
    b2bUserId: string;
    branchId: number;
    status: StockRequestStatus;
    createdAt: string;
    updatedAt: string;
    // Joined
    itemCount?: number;
    totalValue?: number;
    userName?: string;
    items?: StockRequestItem[];
}

export interface CreateStockRequestPayload {
    branchId: number;
    items: { productId: string; quantity: number }[];
}

export interface AuditLog {
    id: number;
    userId: string;
    action: string;
    details: any;
    createdAt: string;
    // Joined
    userName?: string;
}

export interface MpesaTransaction {
    id: number;
    checkoutRequestId: string;
    merchantRequestId: string;
    amount: number;
    phoneNumber: string;
    invoiceId?: number | null;
    saleId?: number | null;
    stockRequestId?: number | null;
    transactionDetails?: any;
    status: string;
    resultDesc?: string | null;
    mpesaReceiptNumber?: string | null;
    createdAt: string;
    updatedAt: string;
    // Joined
    saleNo?: string;
    invoiceNo?: string;
}

export interface LoginResponse {
  user: User;
}