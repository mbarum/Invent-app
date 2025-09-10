import Joi from 'joi';
// FIX: Changed express import to a default import and used qualified types (e.g., `express.Request`). This resolves widespread type conflicts with global types.
import express from 'express';
import { ApplicationStatus, ShippingStatus, QuotationStatus, InvoiceStatus, UserRole } from '@masuma-ea/types';

/**
 * A generic middleware to validate the request body against a Joi schema.
 * @param schema The Joi schema to validate against.
 * @returns An Express middleware function.
 */
// FIX: Added an explicit express.RequestHandler return type and typed inner function arguments to ensure correct type inference from Express.
export const validate = (schema: Joi.Schema): express.RequestHandler => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
        // Create a custom error object for the global error handler
        const validationError: any = new Error(error.details.map(d => d.message).join(', '));
        validationError.statusCode = 400; // Bad Request
        return next(validationError);
    }
    req.body = value; // Assign the validated (and possibly sanitized) value back to req.body
    next();
};


// Generic reusable schemas
const uuid = Joi.string().uuid();
const id = Joi.number().integer().positive();

// --- Auth ---
export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

export const googleLoginSchema = Joi.object({
    token: Joi.string().required(),
});

export const registerSchema = Joi.object({
    businessName: Joi.string().required(),
    kraPin: Joi.string().required(),
    contactName: Joi.string().required(),
    contactEmail: Joi.string().email().required(),
    contactPhone: Joi.string().required(),
    password: Joi.string().min(6).required(),
});


// --- Product ---
export const productSchema = Joi.object({
    partNumber: Joi.string().required(),
    name: Joi.string().required(),
    retailPrice: Joi.number().precision(2).positive().required(),
    wholesalePrice: Joi.number().precision(2).positive().required(),
    stock: Joi.number().integer().min(0).required(),
});

export const updateProductSchema = Joi.object({
    partNumber: Joi.string(),
    name: Joi.string(),
    retailPrice: Joi.number().precision(2).positive(),
    wholesalePrice: Joi.number().precision(2).positive(),
    stock: Joi.number().integer().min(0),
}).min(1);

export const bulkProductSchema = Joi.array().items(productSchema);

// --- B2B ---
export const updateB2BStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(ApplicationStatus)).required(),
});

// --- User ---
export const createUserSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid(...Object.values(UserRole)).required(),
    status: Joi.string().valid('Active', 'Inactive'),
});

export const updateUserSchema = Joi.object({
    name: Joi.string(),
    email: Joi.string().email(),
    role: Joi.string().valid(...Object.values(UserRole)),
    status: Joi.string().valid('Active', 'Inactive'),
}).min(1);

export const updatePasswordSchema = Joi.object({
    currentPassword: Joi.string().min(6),
    newPassword: Joi.string().min(6).required(),
});

// --- POS ---
export const saleItemSchema = Joi.object({
    productId: uuid.required(),
    quantity: Joi.number().integer().positive().required(),
    unitPrice: Joi.number().precision(2).positive().required(),
});

export const createSaleSchema = Joi.object({
    customerId: id.required(),
    branchId: id.required(),
    items: Joi.array().items(saleItemSchema).min(1).required(),
    discount: Joi.number().min(0).required(),
    taxAmount: Joi.number().min(0).required(),
    totalAmount: Joi.number().positive().required(),
    paymentMethod: Joi.string().required(),
    invoiceId: id.optional().allow(null),
});

// --- Shipping ---
export const createLabelSchema = Joi.object({
    sale_id: id.optional().allow(null),
    invoice_id: id.optional().allow(null),
    from_branch_id: id.required(),
    to_customer_id: id.required(),
    from_name: Joi.string().required(),
    from_address: Joi.string().required(),
    from_phone: Joi.string().required(),
    to_name: Joi.string().required(),
    to_address: Joi.string().required(),
    to_phone: Joi.string().required(),
    weight: Joi.number().positive().optional(),
    carrier: Joi.string().optional(),
});

export const updateLabelStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(ShippingStatus)).required(),
});

// --- Quotation ---
export const quotationItemSchema = Joi.object({
    productId: uuid.required(),
    quantity: Joi.number().integer().positive().required(),
    unitPrice: Joi.number().precision(2).positive().required(),
});

export const createQuotationSchema = Joi.object({
    customerId: id.required(),
    branchId: id.required(),
    items: Joi.array().items(quotationItemSchema).min(1).required(),
    validUntil: Joi.date().iso().required(),
});

export const updateQuotationStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(QuotationStatus)).required(),
});


// --- General Data ---
export const createBranchSchema = Joi.object({
    name: Joi.string().required(),
    address: Joi.string().required(),
    phone: Joi.string().required(),
});

export const updateBranchSchema = Joi.object({
    name: Joi.string(),
    address: Joi.string(),
    phone: Joi.string(),
}).min(1);

export const createCustomerSchema = Joi.object({
    name: Joi.string().required(),
    address: Joi.string().required(),
    phone: Joi.string().required(),
    kraPin: Joi.string().optional().allow(''),
});

// --- Settings ---
export const updateSettingsSchema = Joi.object({
    companyName: Joi.string().allow(''),
    companyAddress: Joi.string().allow(''),
    companyPhone: Joi.string().allow(''),
    companyKraPin: Joi.string().allow(''),
    taxRate: Joi.number().min(0).max(100).required(),
    invoiceDueDays: Joi.number().integer().min(0).required(),
    lowStockThreshold: Joi.number().integer().min(0).required(),
    mpesaPaybill: Joi.string().allow(''),
    mpesaConsumerKey: Joi.string().allow(''),
    mpesaConsumerSecret: Joi.string().allow(''),
    mpesaPasskey: Joi.string().allow(''),
});