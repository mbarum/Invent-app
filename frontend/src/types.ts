export enum UserRole {
  SYSTEM_ADMINISTRATOR = 'System Administrator',
  INVENTORY_MANAGER = 'Inventory Manager',
  PROCUREMENT_OFFICER = 'Procurement Officer',
  SALES_STAFF = 'Sales / Counter Staff',
  WAREHOUSE_CLERK = 'Warehouse / Store Clerk',
  ACCOUNTANT = 'Accountant / Finance Officer',
  AUDITOR = 'Auditor',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId?: string;
  businessName?: string;
  status: 'Active' | 'Inactive';
  password?: string;
}


export enum ShippingStatus {
  DRAFT = 'Draft',
  PRINTED = 'Printed',
  SHIPPED = 'Shipped',
}

export enum ApplicationStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export interface BusinessApplication {
  id: string;
  businessName: string;
  kraPin: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  cr12Url?: string;
  certOfIncUrl?: string;
  status: ApplicationStatus;
  submittedAt: string;
  role?: UserRole;
}

export interface RegistrationData extends Omit<BusinessApplication, 'id' | 'status' | 'submittedAt' | 'cr12Url' | 'certOfIncUrl' | 'role'> {
    password?: string;
    certOfInc: File;
    cr12: File;
}

export interface Product {
    id: string;
    partNumber: string;
    name: string;
    retailPrice: number;
    wholesalePrice: number;
    stock: number;
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

export interface SaleItem {
    id: number;
    sale_id: number;
    product_id: string;
    quantity: number;
    unit_price: number;
    product_name?: string; // Optional: denormalized for easier receipt generation
    part_number?: string; // Optional: denormalized
}


export interface Sale {
    id: number;
    sale_no: string;
    customer_id: number;
    branch_id: number;
    created_at: string;
    amount?: number;
    invoice_id?: number;
    // For receipt generation
    tax_amount?: number;
    payment_method?: string;
    // FIX: Allow items to be an array for detailed views (receipts) or a number for summary views (reports).
    items?: SaleItem[] | number;
    customer?: Customer; 
    branch?: Branch;
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
  DRAFT = 'Draft',
  UNPAID = 'Unpaid',
  PAID = 'Paid',
  VOID = 'Void',
}

export interface QuotationItem {
  id: number;
  quotation_id: number;
  product_id: string;
  quantity: number;
  unit_price: number;
  product_name?: string;
  part_number?: string;
}

export interface Quotation {
  id: number;
  quotation_no: string;
  customer_id: number;
  branch_id: number;
  created_at: string;
  valid_until: string;
  status: QuotationStatus;
  amount?: number;
  items?: QuotationItem[];
  customer?: Customer;
  branch?: Branch;
  customerName?: string; // For simplified lists
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  product_id: string;
  quantity: number;
  unit_price: number;
  product_name?: string;
  part_number?: string;
}

export interface Invoice {
    id: number;
    invoice_no: string;
    customer_id: number;
    branch_id: number;
    created_at: string;
    due_date: string;
    status: InvoiceStatus;
    quotation_id?: number;
    amount?: number;
    amount_paid?: number;
    items?: InvoiceItem[];
    customer?: Customer;
    branch?: Branch;
    customerName?: string;
}


export interface ShippingLabel {
  id: string;
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
  created_at: string;
}

export interface NotificationPayload {
    newApplications: BusinessApplication[];
    lowStockProducts: Product[];
    serverTimestamp: string;
}

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyKraPin: string;
  taxRate: number;
  invoiceDueDays: number;
  lowStockThreshold: number;
  // M-Pesa Settings
  mpesaPaybill: string;
  mpesaConsumerKey: string;
  mpesaConsumerSecret: string;
  mpesaPasskey: string;
}
