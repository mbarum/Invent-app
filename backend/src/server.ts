/// <reference types="node" />

// FIX: Reverted from namespace import to default and named imports for Express types.
// This resolves type conflicts with middleware and route handlers by ensuring a consistent
// type source for Request, Response, and NextFunction.
import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Knex } from 'knex';
import Joi from 'joi';
import axios from 'axios';
import fs from 'fs';

import db from './db.ts';
import { sendNotificationEmail, generateLowStockHtml, generateNewB2BAppHtml, generateNewStockRequestHtml } from './services/emailService.ts';
import { 
    validate, loginSchema, googleLoginSchema, registerSchema, productSchema, updateProductSchema, bulkProductSchema,
    updateB2BStatusSchema, createStockRequestSchema, updateStockRequestStatusSchema, createUserSchema, updateUserSchema,
    updatePasswordSchema, createSaleSchema, createLabelSchema, updateLabelStatusSchema, createQuotationSchema,
    updateQuotationStatusSchema, createBranchSchema, updateBranchSchema, createCustomerSchema, updateSettingsSchema
} from './validation.ts';
import { 
    User, UserRole, BusinessApplication, Product, AppSettings, Quotation, Invoice, Sale, StockRequest,
    ApplicationStatus, NotificationPayload, UserNotification, FastMovingProduct,
    StockRequestStatus,
    MpesaTransactionPayload,
    Sale as SaleType,
    DashboardStats,
    ShippingStatus,
    InvoiceStatus,
    QuotationStatus
} from '@masuma-ea/types';


// --- SETUP ---
dotenv.config();
// FIX: Use Express type from named import.
const app: Express = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`Uploads directory not found. Creating it at: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}


// --- TYPE AUGMENTATION ---
// FIX: Extend Request from the named import.
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });

// --- HELPERS ---
const getAppSettings = async (): Promise<AppSettings> => {
    const settingsData = await db('app_settings').select('*');
    const settings: any = {};
    settingsData.forEach(s => {
        const num = Number(s.setting_value);
        settings[s.setting_key] = isNaN(num) ? s.setting_value : num;
    });
    return settings as AppSettings;
};

const getUsersByRoles = async (roles: UserRole[]): Promise<Pick<User, 'email'>[]> => {
    return db('users').whereIn('role', roles).andWhere('status', 'Active').select('email');
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// FIX: The B2B registration route uses multipart/form-data for file uploads.
// It must be defined BEFORE the general express.json() body parser to prevent
// the JSON parser from trying to handle the multipart stream, which causes a network error.
// FIX: Use Request, Response, NextFunction from named imports.
app.post('/api/auth/register', upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files || !files.certOfInc?.[0] || !files.cr12?.[0]) {
            return res.status(400).json({ message: 'Both Certificate of Incorporation and CR12 documents must be uploaded.' });
        }
        
        const certOfIncUrl = files.certOfInc[0].path;
        const cr12Url = files.cr12[0].path;
        
        const passwordHash = await bcrypt.hash(password, 10);
        const application = {
            id: uuidv4(),
            business_name: businessName,
            kra_pin: kraPin,
            contact_name: contactName,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            password_hash: passwordHash,
            cert_of_inc_url: path.relative(path.join(__dirname, '..'), certOfIncUrl),
            cr12_url: path.relative(path.join(__dirname, '..'), cr12Url),
        };
        await db('b2b_applications').insert(application);

        // --- ADD EMAIL NOTIFICATION TO ADMINS ---
        const admins = await getUsersByRoles([UserRole.SYSTEM_ADMINISTRATOR]);
        const emailHtml = generateNewB2BAppHtml(businessName, contactName);
        for (const admin of admins) {
            await sendNotificationEmail(admin.email, 'New B2B Application Received', emailHtml);
        }
        // --- END ---

        res.status(201).json({ message: 'Application submitted successfully.' });
    } catch (error) { next(error); }
});


// General body parsers for JSON and URL-encoded data.
// These must come AFTER any routes that handle multipart data.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(UPLOADS_DIR));

// --- AUTH MIDDLEWARE ---
// FIX: Use Response, NextFunction from named imports.
const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication token required.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const user = await db('users').where('id', decoded.userId).first();
        if (!user || user.status === 'Inactive') {
            return res.status(401).json({ message: 'User not found or inactive.' });
        }
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
            status: user.status as 'Active' | 'Inactive',
            customer_id: user.customer_id
        };
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

// FIX: Use Response, NextFunction from named imports.
const hasPermission = (permission: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === UserRole.SYSTEM_ADMINISTRATOR) {
        return next();
    }
    console.warn(`Permission check for '${permission}' is not fully implemented. Allowing for now.`);
    next();
};

const logAuditEvent = async (userId: string, action: string, details: any, trx?: Knex.Transaction) => {
    const dbInstance = trx || db;
    await dbInstance('audit_logs').insert({
        user_id: userId,
        action,
        details: JSON.stringify(details),
    });
};

// --- SALES / POS ---
// FIX: Use Response, NextFunction from named imports.
app.post('/api/sales', authenticate, hasPermission('use:pos'), validate(createSaleSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { customerId, branchId, items, discountAmount, taxAmount, totalAmount, paymentMethod, invoiceId } = req.body;
        
        let newSale;
        const settings = await getAppSettings();
        const lowStockThreshold = settings.lowStockThreshold || 10;

        await db.transaction(async (trx) => {
            const productIds = items.map((item: any) => item.productId);
            const productsInDb = await trx('products').whereIn('id', productIds).select('id', 'stock', 'name', 'part_number');
            const stockMap = new Map(productsInDb.map(p => [p.id, { stock: p.stock, name: p.name, part_number: p.part_number }]));

            for (const item of items) {
                const product = stockMap.get(item.productId);
                if (!product || product.stock < item.quantity) {
                    const error: any = new Error(`Insufficient stock for ${product?.name || item.productId}.`);
                    error.statusCode = 409;
                    throw error;
                }
            }

            const saleNo = `SALE-${Date.now()}`;
            const [insertedSale] = await trx('sales').insert({
                sale_no: saleNo,
                customer_id: customerId,
                branch_id: branchId,
                discount_amount: discountAmount,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                payment_method: paymentMethod,
                invoice_id: invoiceId,
            }).returning('*');

            const saleItems = items.map((item: any) => ({
                sale_id: insertedSale.id,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice,
            }));
            await trx('sale_items').insert(saleItems);

            const adminsForNotifications = await getUsersByRoles([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]);

            for (const item of items) {
                await trx('products').where('id', item.productId).decrement('stock', item.quantity);
                
                const productInfo = stockMap.get(item.productId)!;
                const newStockLevel = productInfo.stock - item.quantity;
                if (newStockLevel <= lowStockThreshold) {
                    const emailHtml = generateLowStockHtml(productInfo.name, newStockLevel, productInfo.part_number, 50); // Using 50 as a default reorder amount
                    for (const admin of adminsForNotifications) {
                        await sendNotificationEmail(admin.email, `Low Stock Alert: ${productInfo.name}`, emailHtml);
                    }
                }
            }

            if (invoiceId) {
                await trx('invoices').where('id', invoiceId).update({
                    status: 'Paid',
                    amount_paid: db.raw('amount_paid + ?', [totalAmount]),
                });
            }

            await logAuditEvent(req.user!.id, 'CREATE_SALE', { saleId: insertedSale.id, total: totalAmount }, trx);
            
            const customer = await trx('customers').where('id', customerId).first();
            const branch = await trx('branches').where('id', branchId).first();
            const populatedItems = await Promise.all(items.map(async (item: any) => {
                const product = await trx('products').where('id', item.productId).first();
                return { ...item, product_name: product.name };
            }));

            newSale = { ...insertedSale, items: populatedItems, customer, branch };
        });

        res.status(201).json(newSale);

    } catch (error) { next(error); }
});

// --- STOCK REQUESTS (B2B) ---
// FIX: Use Response, NextFunction from named imports.
app.post('/api/stock-requests', authenticate, hasPermission('use:b2b_portal'), validate(createStockRequestSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { branchId, items } = req.body;
        const b2bUserId = req.user!.id;

        let newStockRequest: any;
        await db.transaction(async (trx) => {
            const [insertedRequest] = await trx('stock_requests').insert({
                b2b_user_id: b2bUserId,
                branch_id: branchId,
                status: 'Pending',
            }).returning('*');

            const products = await trx('products').whereIn('id', items.map((i: any) => i.productId)).select('id', 'wholesale_price');
            const productPriceMap = new Map(products.map(p => [p.id, p.wholesale_price]));

            const requestItems = items.map((item: any) => ({
                stock_request_id: insertedRequest.id,
                product_id: item.productId,
                quantity: item.quantity,
                wholesale_price_at_request: productPriceMap.get(item.productId) || 0,
            }));

            await trx('stock_request_items').insert(requestItems);
            newStockRequest = { ...insertedRequest, items: requestItems };
        });
        
        const admins = await getUsersByRoles([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]);
        const emailHtml = generateNewStockRequestHtml(req.user!.name, newStockRequest.id);
        for (const admin of admins) {
            await sendNotificationEmail(admin.email, 'New Stock Request Received', emailHtml);
        }

        res.status(201).json(newStockRequest);
    } catch (error) { next(error); }
});

// --- M-PESA TRANSACTIONS ---
app.get('/api/mpesa/transactions', authenticate, hasPermission('view:mpesa_logs'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = 1, limit = 15 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const query = db('mpesa_transactions')
      .select(
        'mpesa_transactions.*',
        'sales.sale_no',
        'invoices.invoice_no'
      )
      .leftJoin('sales', 'mpesa_transactions.sale_id', 'sales.id')
      .leftJoin('invoices', 'mpesa_transactions.invoice_id', 'invoices.id')
      .orderBy('mpesa_transactions.created_at', 'desc')
      .limit(Number(limit))
      .offset(offset);

    const countQuery = db('mpesa_transactions').count({ total: '*' }).first();

    if (status && status !== 'All') {
      query.where('mpesa_transactions.status', status as string);
      countQuery.where('status', status as string);
    }
    
    const [transactions, totalResult] = await Promise.all([query, countQuery]);
    
    res.json({
      transactions,
      total: totalResult ? totalResult.total : 0,
    });

  } catch (error) {
    next(error);
  }
});


// --- ERROR HANDLING & OTHER ROUTES... ---
// (Assuming other routes from the original file would be here)
// For this change, I am only showing the parts that were modified or added.
// The rest of the original server.ts file should follow.
// ...