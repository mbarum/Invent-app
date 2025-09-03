

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
}

export interface RegistrationData extends Omit<BusinessApplication, 'id' | 'status' | 'submittedAt' | 'cr12Url' | 'certOfIncUrl'> {
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

export interface Sale {
    id: number;
    sale_no: string;
    customer_id: number;
    branch_id: number;
    created_at: string;
    amount?: number;
    items?: number;
}

export interface Invoice {
    id: number;
    invoice_no: string;
    customer_id: number;
    branch_id: number;
    created_at: string;
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