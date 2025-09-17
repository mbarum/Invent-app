import Joi from 'joi';
import { RequestHandler } from 'express';
import { ApplicationStatus, ShippingStatus, QuotationStatus, InvoiceStatus, UserRole, StockRequestStatus } from '@masuma-ea/types';

/**
 * A generic middleware to validate the request body against a Joi schema.
 * @param schema The Joi schema to validate against.
 * @returns An Express middleware function.
 */
export const validate = (schema: Joi.Schema): RequestHandler => (req, res, next) => {
    // We validate req.body for most POST/PUT, but some data might be in other places for multipart forms
    const dataToValidate = { ...req.body, ...req.params, ...req.query };

    const { error, value } = schema.validate(dataToValidate, { abortEarly: false, stripUnknown: true });
    if (error) {
        const validationError: any = new Error(error.details.map(d => d.message).join(', '));
        validationError.statusCode = 400; // Bad Request
        return next(validationError);
    }
    
    // Only assign validated values back to req.body
    // This prevents query/params from overwriting the body
    Object.keys(req.body).forEach(key => {
      if (value[key] !== undefined) {
        (req.body as any)[key] = value[key];
      }
    });

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

// Note: For multipart forms, Joi validation on files is limited.
// Multer handles file presence, and we trust the data post-upload.
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
    oemNumbers: Joi.array().items(Joi.string().allow('')).optional(),
    name: Joi.string().required(),
    retailPrice: Joi.number().precision(2).min(0).required(),
    wholesalePrice: Joi.number().precision(2).min(0).required(),
    stock: Joi.number().integer().min(0).required(),
    notes: Joi.string().allow('').optional(),
});

export const updateProductSchema = Joi.object({
    partNumber: Joi.string(),
    oemNumbers: Joi.array().items(Joi.string().allow('')).optional(),
    name: Joi.string(),
    retailPrice: Joi.number().precision(2).min(0),
    wholesalePrice: Joi.number().precision(2).min(0),
    stock: Joi.number().integer().min(0),
    notes: Joi.string().allow('').optional(),
}).min(1);

// --- B2B ---
export const updateB2BStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(ApplicationStatus)).required(),
});

// --- Stock Requests ---
export const stockRequestItemSchema = Joi.object({
    productId: uuid.required(),
    quantity: Joi.number().integer().positive().required(),
});

export const createStockRequestSchema = Joi.object({
    branchId: id.required(),
    items: Joi.array().items(stockRequestItemSchema).min(1).required(),
});

export const updateStockRequestStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(StockRequestStatus)).required(),
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
    unitPrice: Joi.number().precision(2).min(0).required(),
});

export const createSaleSchema = Joi.object({
    customerId: id.required(),
    branchId: id.required(),
    items: Joi.array().items(saleItemSchema).min(1).required(),
    discountAmount: Joi.number().min(0).required(),
    taxAmount: Joi.number().min(0).required(),
    totalAmount: Joi.number().min(0).required(),
    paymentMethod: Joi.string().required(),
    invoiceId: id.optional().allow(null),
});

// --- Shipping ---
export const createLabelSchema = Joi.object({
    saleId: id.optional().allow(null),
    invoiceId: id.optional().allow(null),
    fromBranchId: id.required(),
    toCustomerId: id.required(),
    fromName: Joi.string().required(),
    fromAddress: Joi.string().required(),
    fromPhone: Joi.string().required(),
    toName: Joi.string().required(),
    toAddress: Joi.string().required(),
    toPhone: Joi.string().required(),
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
    unitPrice: Joi.number().precision(2).min(0).required(),
});

export const createQuotationSchema = Joi.object({
    customerId: id.required(),
    branchId: id.required(),
    items: Joi.array().items(quotationItemSchema).min(1).required(),
    validUntil: Joi.date().iso().required(),
    subtotal: Joi.number().min(0).required(),
    discountAmount: Joi.number().min(0).required(),
    taxAmount: Joi.number().min(0).required(),
    totalAmount: Joi.number().min(0).required(),
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
    companyName: Joi.string().allow('').optional(),
    companyAddress: Joi.string().allow('').optional(),
    companyPhone: Joi.string().allow('').optional(),
    companyKraPin: Joi.string().allow('').optional(),
    taxRate: Joi.number().min(0).max(100).optional(),
    invoiceDueDays: Joi.number().integer().min(0).optional(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),
    mpesaPaybill: Joi.string().allow('').optional(),
    mpesaConsumerKey: Joi.string().allow('').optional(),
    mpesaConsumerSecret: Joi.string().allow('').optional(),
    mpesaPasskey: Joi.string().allow('').optional(),
    mpesaEnvironment: Joi.string().valid('sandbox', 'live').allow('').optional(),
    paymentDetails: Joi.string().allow('').optional(),
    paymentTerms: Joi.string().allow('').optional(),
});
