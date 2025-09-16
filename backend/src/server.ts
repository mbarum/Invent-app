// This line must be at the very top to ensure path aliases are registered
import 'tsconfig-paths/register';

// FIX: Removed named imports that conflict with global DOM types.
// All Express types will be referenced via the `express` namespace (e.g., `express.Request`).
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenAI, Type } from '@google/genai';


// Local Imports
import db from './db';
import * as V from './validation';
import { sendNotificationEmail, generateNewB2BAppHtml, generateNewStockRequestHtml } from './services/emailService';
import { User, UserRole, ApplicationStatus, NotificationPayload, SaleItem, Sale, StockRequestStatus, InvoiceStatus, ShippingStatus, QuotationStatus } from '@masuma-ea/types';

// Load environment variables from .env file
dotenv.config();

// --- SETUP ---
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in the environment variables.");
    process.exit(1);
}
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// --- GEMINI SETUP ---
// Ensure API_KEY is available in the environment.
if (!process.env.API_KEY) {
    console.warn("⚠️  WARNING: API_KEY is not defined. AI features will be disabled.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });


// --- CUSTOM TYPES ---
// FIX: Extended from `express.Request` to avoid type collision with global DOM `Request`.
export interface AuthenticatedRequest extends express.Request {
    user?: User;
}

// --- MIDDLEWARE ---
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded documents statically
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsPath),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });


// --- HELPERS ---
const createAuditLog = async (userId: string, action: string, details: object, trx?: Knex.Transaction) => {
    const dbOrTrx = trx || db;
    try {
        await dbOrTrx('audit_logs').insert({
            userId: userId,
            action,
            details: JSON.stringify(details)
        });
    } catch (error) {
        console.error(`Failed to create audit log for action ${action}:`, error);
    }
};

const createNotification = async (
    userId: string, message: string, link: string, type: string, entityId: string | number, trx?: Knex.Transaction
) => {
    const dbOrTrx = trx || db;
    try {
        const existing = await dbOrTrx('notifications').where({ userId: userId, type, entityId: String(entityId), isRead: false }).first();
        if (!existing) {
            await dbOrTrx('notifications').insert({ userId: userId, message, link, type, entityId: String(entityId) });
        }
    } catch (error) {
        console.error(`Failed to create notification for user ${userId}:`, error);
    }
};

// --- AUTHENTICATION MIDDLEWARE ---
// FIX: Updated types to `express.Response` and `express.NextFunction` for correctness.
const authenticateToken = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (err) return res.sendStatus(403);
        if (decoded && typeof decoded === 'object' && decoded.id) {
            req.user = { id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role, status: 'Active' };
            next();
        } else {
            return res.status(403).json({ message: 'Invalid token payload' });
        }
    });
};

// FIX: Updated types to `express.Response` and `express.NextFunction` for correctness.
const authorizeRole = (requiredRoles: UserRole | UserRole[]) => (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
    }
    next();
};


// =================================================================
// --- PUBLIC API ROUTES ---
// =================================================================

// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.post('/api/auth/login', V.validate(V.loginSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { email, password } = req.body;
        const user = await db('users').where({ email }).first();
        if (!user || !user.passwordHash || user.status !== 'Active') {
            return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });
        
        const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.post('/api/auth/google', V.validate(V.googleLoginSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { token: googleToken } = req.body;
        const ticket = await googleClient.verifyIdToken({ idToken: googleToken, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) return res.status(400).json({ message: 'Invalid Google token.' });

        let user = await db('users').where({ email: payload.email }).first();
        if (!user) {
             return res.status(401).json({ message: 'Google account not associated with any user. Please register or contact admin.' });
        }
        
        const jwtPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
        const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.post('/api/auth/register', upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), V.validate(V.registerSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files.certOfInc || !files.cr12) return res.status(400).json({ message: 'Both required documents must be uploaded.' });

        const passwordHash = await bcrypt.hash(password, 10);
        await db.transaction(async trx => {
            const applicationId = uuidv4();
            await trx('b2b_applications').insert({
                id: applicationId, businessName: businessName, kraPin: kraPin, contactName: contactName,
                contactEmail: contactEmail, contactPhone: contactPhone, passwordHash: passwordHash,
                certOfIncUrl: path.basename(files.certOfInc[0].path), cr12Url: path.basename(files.cr12[0].path),
                status: ApplicationStatus.PENDING,
            });
            await sendNotificationEmail('systems@masuma.africa', 'New B2B Application', generateNewB2BAppHtml(businessName, contactName));
            
            const admins = await trx('users').whereIn('role', [UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]).select('id');
            for (const admin of admins) {
                await createNotification(admin.id, `New B2B application from ${businessName}.`, '/b2b-management', 'NEW_B2B_APPLICATION', applicationId, trx);
            }
        });
        res.status(201).json({ message: 'Application submitted successfully. It is now under review.' });
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An account with this email already exists.' });
        next(error);
    }
});

// =================================================================
// --- PROTECTED API ROUTES ---
// =================================================================
app.use('/api', authenticateToken);

// --- Dashboard ---
// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/dashboard/stats', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { start, end, branchId } = req.query;
        const salesQuery = db('sales').where('branchId', branchId).andWhereBetween('createdAt', [new Date(start as string), new Date(end as string)]);
        const revenue = await salesQuery.clone().sum('totalAmount as total').first();
        const salesCount = await salesQuery.clone().count('id as count').first();
        const activeCustomers = await salesQuery.clone().countDistinct('customerId as count').first();
        const shippingQuery = db('shipping_labels').where('fromBranchId', branchId).andWhereBetween('createdAt', [new Date(start as string), new Date(end as string)]);
        const totalShipments = await shippingQuery.clone().count('id as count').first();
        const pendingShipments = await shippingQuery.clone().whereNot('status', 'Shipped').count('id as count').first();
        const target = await db('app_settings').where('settingKey', 'salesTarget').first();
        res.json({
            totalRevenue: Number(revenue?.total) || 0, totalSales: Number(salesCount?.count) || 0,
            activeCustomers: Number(activeCustomers?.count) || 0, totalShipments: Number(totalShipments?.count) || 0,
            pendingShipments: Number(pendingShipments?.count) || 0, salesTarget: Number(target?.settingValue) || 5000000,
        });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.put('/api/dashboard/sales-target', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { target } = req.body;
        await db('app_settings').insert({ settingKey: 'salesTarget', settingValue: target.toString() }).onConflict('settingKey').merge();
        res.json({ salesTarget: target });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/dashboard/sales-chart', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { start, end, branchId } = req.query;
        const results = await db('sales').select(db.raw('DATE(created_at) as name, COUNT(id) as sales, SUM(total_amount) as revenue'))
            .where('branchId', branchId).andWhereBetween('createdAt', [new Date(start as string), new Date(end as string)])
            .groupBy('name').orderBy('name', 'asc');
        res.json(results);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/dashboard/fast-moving', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { start, end, branchId } = req.query;
        const results = await db('sale_items').select('products.id', 'products.name', 'products.stock as currentStock', db.raw('SUM(sale_items.quantity) as totalSold'))
            .join('sales', 'sale_items.saleId', 'sales.id').join('products', 'sale_items.productId', 'products.id')
            .where('sales.branchId', branchId).andWhereBetween('sales.createdAt', [new Date(start as string), new Date(end as string)])
            .groupBy('products.id', 'products.name', 'products.stock')
            .orderByRaw('SUM(sale_items.quantity) DESC')
            .limit(10);
        res.json(results);
    } catch (error) { next(error); }
});

// --- Products & Inventory ---
// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/products', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const products = await db('products').select('*');
        const productIds = products.map(p => p.id);
        const oemNumbers = await db('product_oem_numbers').whereIn('productId', productIds).select('productId', 'oemNumber');
        const oemMap = oemNumbers.reduce((acc, row) => {
            if (!acc[row.productId]) acc[row.productId] = [];
            acc[row.productId].push(row.oemNumber);
            return acc;
        }, {} as Record<string, string[]>);
        res.json(products.map(p => ({ ...p, oemNumbers: oemMap[p.id] || [] })));
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/products', V.validate(V.productSchema), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { oemNumbers, ...productData } = req.body;
        const newProduct = await db.transaction(async trx => {
            const productId = uuidv4();
            await trx('products').insert({ id: productId, ...productData });
            if (oemNumbers && oemNumbers.length > 0) {
                await trx('product_oem_numbers').insert(oemNumbers.map((oem: string) => ({ productId: productId, oemNumber: oem })));
            }
            await createAuditLog(req.user!.id, 'CREATE_PRODUCT', { productId: productId, partNumber: productData.partNumber }, trx);
            
            const finalProduct = await trx('products').where({ id: productId }).first();
            return { ...finalProduct, oemNumbers: oemNumbers || [] };
        });
        res.status(201).json(newProduct);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/products/import', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { products } = req.body;
        await db.transaction(async trx => {
            for (const p of products) {
                const { oemNumbers, ...productData } = p;
                const existing = await trx('products').where('partNumber', productData.partNumber).first();
                if (existing) {
                    await trx('products').where('id', existing.id).update(productData);
                    await trx('product_oem_numbers').where('productId', existing.id).del();
                    if (oemNumbers && oemNumbers.length > 0) {
                        await trx('product_oem_numbers').insert(oemNumbers.map((oem: string) => ({ productId: existing.id, oemNumber: oem })));
                    }
                } else {
                    const productId = uuidv4();
                    await trx('products').insert({ id: productId, ...productData });
                    if (oemNumbers && oemNumbers.length > 0) {
                        await trx('product_oem_numbers').insert(oemNumbers.map((oem: string) => ({ productId: productId, oemNumber: oem })));
                    }
                }
            }
            await createAuditLog(req.user!.id, 'IMPORT_PRODUCTS', { count: products.length }, trx);
        });
        res.status(201).json({ count: products.length });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.put('/api/products/:id', V.validate(V.updateProductSchema), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const { oemNumbers, ...productData } = req.body;
        await db.transaction(async trx => {
            if (Object.keys(productData).length > 0) {
                await trx('products').where({ id }).update(productData);
            }
            if (typeof oemNumbers !== 'undefined') {
                await trx('product_oem_numbers').where({ productId: id }).del();
                if (oemNumbers.length > 0) {
                    await trx('product_oem_numbers').insert(oemNumbers.map((oem: string) => ({ productId: id, oemNumber: oem })));
                }
            }
            await createAuditLog(req.user!.id, 'UPDATE_PRODUCT', { productId: id }, trx);
        });
        const updated = await db('products').where({ id }).first();
        const updatedOems = await db('product_oem_numbers').where({ productId: id }).select('oemNumber');
        res.json({ ...updated, oemNumbers: updatedOems.map(o => o.oemNumber) });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.delete('/api/products/:id', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        await db('products').where({ id: req.params.id }).del(); // onDelete('CASCADE') handles oem_numbers
        await createAuditLog(req.user!.id, 'DELETE_PRODUCT', { productId: req.params.id });
        res.sendStatus(204);
    } catch (error) { next(error); }
});

// --- Sales & POS ---
// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/sales', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { start, end } = req.query;
        let query = db('sales')
            .select('sales.*', db.raw('(SELECT COUNT(*) FROM sale_items WHERE sale_items.sale_id = sales.id) as item_count'))
            .orderBy('createdAt', 'desc');
        if (start) query.where('createdAt', '>=', new Date(start as string));
        if (end) query.where('createdAt', '<=', new Date(end as string));
        res.json(await query);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/sales/:id', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const sale = await db('sales')
            .where('sales.id', id)
            .join('customers', 'sales.customerId', 'customers.id')
            .join('branches', 'sales.branchId', 'branches.id')
            .select(
                'sales.*', 
                'customers.name as customerName', 
                'customers.address as customerAddress', 
                'customers.phone as customerPhone', 
                'branches.name as branchName', 
                'branches.address as branchAddress', 
                'branches.phone as branchPhone'
            )
            .first();

        if (!sale) {
            return res.status(404).json({ message: 'Sale not found' });
        }

        const items = await db('sale_items')
            .where({ saleId: id })
            .join('products', 'sale_items.productId', 'products.id')
            .select('sale_items.*', 'products.name as productName', 'products.partNumber');

        const fullSale = {
            ...sale,
            items,
            customer: { id: sale.customerId, name: sale.customerName, address: sale.customerAddress, phone: sale.customerPhone },
            branch: { id: sale.branchId, name: sale.branchName, address: sale.branchAddress, phone: sale.branchPhone }
        };
        
        res.json(fullSale);
    } catch (error) {
        next(error);
    }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/sales', V.validate(V.createSaleSchema), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { customerId, branchId, items, taxAmount, totalAmount, paymentMethod, invoiceId, discountAmount } = req.body;
        const saleDetails = await db.transaction(async trx => {
            const saleNo = `SALE-${Date.now()}`;
            const saleData = {
                saleNo: saleNo,
                customerId: customerId,
                branchId: branchId,
                taxAmount: taxAmount,
                totalAmount: totalAmount,
                discountAmount: discountAmount,
                paymentMethod: paymentMethod,
                invoiceId: invoiceId
            };
            
            const [saleId] = await trx('sales').insert(saleData);
            await trx('sale_items').insert(items.map((item: SaleItem) => ({ saleId: saleId, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })));
            
            for (const item of items) {
                await trx('products').where('id', item.productId).decrement('stock', item.quantity);
            }

            if (invoiceId) {
                await trx('invoices').where('id', invoiceId).update({ status: InvoiceStatus.PAID, amountPaid: db.raw(`amount_paid + ?`, [totalAmount]) });
            }

            await createAuditLog(req.user!.id, 'CREATE_SALE', { saleId: saleId, saleNo }, trx);
            
            const saleItemsDetails = await trx('sale_items').where({ saleId: saleId }).join('products', 'sale_items.productId', 'products.id').select('sale_items.*', 'products.name as productName', 'products.partNumber');
            const fullSale = await trx('sales').where('sales.id', saleId).join('customers', 'sales.customerId', 'customers.id').join('branches', 'sales.branchId', 'branches.id').select('sales.*', 'customers.name as customerName', 'customers.address as customerAddress', 'customers.phone as customerPhone', 'branches.name as branchName', 'branches.address as branchAddress', 'branches.phone as branchPhone').first();
            
            return {
                ...fullSale,
                id: saleId,
                items: saleItemsDetails,
                customer: { name: fullSale.customerName, address: fullSale.customerAddress, phone: fullSale.customerPhone },
                branch: { name: fullSale.branchName, address: fullSale.branchAddress, phone: fullSale.branchPhone }
            };
        });
        res.status(201).json(saleDetails);
    } catch (error) { next(error); }
});

// --- Invoices & Quotations ---
// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/invoices', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { status } = req.query;
        let query = db('invoices').select('invoices.*', 'customers.name as customerName').join('customers', 'invoices.customerId', 'customers.id').orderBy('createdAt', 'desc');
        if (status && status !== 'All') query.where({ status: status as string });
        res.json(await query);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/invoices/snippets/unpaid', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try { res.json(await db('invoices').select('id', 'invoiceNo').where('status', InvoiceStatus.UNPAID).orderBy('createdAt', 'desc')); } catch (error) { next(error); }
});

// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/invoices/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const invoice = await db('invoices').where('invoices.id', req.params.id).join('customers', 'invoices.customerId', 'customers.id').join('branches', 'invoices.branchId', 'branches.id').select('invoices.*', 'customers.name as customerName', 'customers.address as customerAddress', 'customers.phone as customerPhone', 'branches.name as branchName', 'branches.address as branchAddress', 'branches.phone as branchPhone').first();
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
        const items = await db('invoice_items').where({ invoiceId: req.params.id }).join('products', 'invoice_items.productId', 'products.id').select('invoice_items.*', 'products.name as productName', 'products.partNumber');
        res.json({ ...invoice, items, customer: { name: invoice.customerName, address: invoice.customerAddress, phone: invoice.customerPhone }, branch: { name: invoice.branchName, address: invoice.branchAddress, phone: invoice.branchPhone } });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/quotations', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try { res.json(await db('quotations').select('quotations.*', 'customers.name as customerName').join('customers', 'quotations.customerId', 'customers.id').orderBy('createdAt', 'desc')); } catch (error) { next(error); }
});

// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/quotations/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const quote = await db('quotations').where('quotations.id', req.params.id).join('customers', 'quotations.customerId', 'customers.id').join('branches', 'quotations.branchId', 'branches.id').select('quotations.*', 'customers.name as customerName', 'customers.address as customerAddress', 'customers.phone as customerPhone', 'branches.name as branchName', 'branches.address as branchAddress', 'branches.phone as branchPhone').first();
        if (!quote) return res.status(404).json({ message: 'Quotation not found' });
        const items = await db('quotation_items').where({ quotationId: req.params.id }).join('products', 'quotation_items.productId', 'products.id').select('quotation_items.*', 'products.name as productName', 'products.partNumber');
        res.json({ ...quote, items, customer: { name: quote.customerName, address: quote.customerAddress, phone: quote.customerPhone }, branch: { name: quote.branchName, address: quote.branchAddress, phone: quote.branchPhone } });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/quotations', V.validate(V.createQuotationSchema), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { customerId, branchId, items, validUntil, subtotal, discountAmount, taxAmount, totalAmount } = req.body;
        const newQuote = await db.transaction(async trx => {
            const quoteNo = `QUO-${Date.now()}`;
            const quoteData = { 
                quotationNo: quoteNo, 
                customerId: customerId, 
                branchId: branchId, 
                validUntil: validUntil, 
                subtotal,
                discountAmount,
                taxAmount,
                totalAmount, 
                status: QuotationStatus.DRAFT 
            };
            const [quoteId] = await trx('quotations').insert(quoteData);
            await trx('quotation_items').insert(items.map((item: any) => ({ quotationId: quoteId, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })));
            await createAuditLog(req.user!.id, 'CREATE_QUOTATION', { quotationId: quoteId, quoteNo }, trx);
            return { id: quoteId, ...quoteData };
        });
        res.status(201).json(newQuote);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.patch('/api/quotations/:id/status', V.validate(V.updateQuotationStatusSchema), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        await db('quotations').where({ id }).update({ status: req.body.status });
        const updated = await db('quotations').where({ id }).first();
        res.json(updated);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/quotations/:id/convert-to-invoice', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const newInvoice = await db.transaction(async trx => {
            const quote = await trx('quotations').where({ id: req.params.id }).first();
            if (!quote || quote.status !== QuotationStatus.ACCEPTED) throw new Error('Quotation not found or not accepted.');
            const items = await trx('quotation_items').where({ quotationId: quote.id });
            const invoiceNo = `INV-${Date.now()}`;
            const settings = await trx('app_settings').where('settingKey', 'invoiceDueDays').first();
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (Number(settings?.settingValue) || 30));
            
            const invoiceData = { invoiceNo: invoiceNo, customerId: quote.customerId, branchId: quote.branchId, quotationId: quote.id, dueDate: dueDate, totalAmount: quote.totalAmount, status: InvoiceStatus.UNPAID };
            const [invoiceId] = await trx('invoices').insert(invoiceData);
            
            await trx('invoice_items').insert(items.map(i => ({ invoiceId: invoiceId, productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })));
            await trx('quotations').where({ id: quote.id }).update({ status: QuotationStatus.INVOICED });
            await createAuditLog(req.user!.id, 'CONVERT_QUOTATION', { quotationId: quote.id, invoiceId: invoiceId }, trx);
            
            const finalInvoice = await trx('invoices').where({id: invoiceId}).first();
            return finalInvoice;
        });
        res.status(201).json(newInvoice);
    } catch (error) { next(error); }
});

// --- Shipping ---
// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.get('/api/shipping', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try { res.json(await db('shipping_labels').orderBy('createdAt', 'desc')); } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/shipping', V.validate(V.createLabelSchema), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const labelId = uuidv4();
        const newLabelData = { id: labelId, ...req.body, status: ShippingStatus.DRAFT };
        await db('shipping_labels').insert(newLabelData);
        res.status(201).json(newLabelData);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.patch('/api/shipping/:id/status', V.validate(V.updateLabelStatusSchema), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        await db('shipping_labels').where({ id }).update({ status: req.body.status });
        const updated = await db('shipping_labels').where({ id }).first();
        res.json(updated);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/reports/shipments', async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { start, end } = req.query;
        res.json(await db('shipping_labels').whereBetween('createdAt', [new Date(start as string), new Date(end as string)]));
    } catch (error) { next(error); }
});

// --- B2B Management ---
// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/b2b/applications', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const applications = await db('b2b_applications').orderBy('submittedAt', 'desc');
        res.json(applications);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.patch('/api/b2b/applications/:id', V.validate(V.updateB2BStatusSchema), authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const updatedApp = await db.transaction(async trx => {
            const application = await trx('b2b_applications').where({ id }).first();
            if (!application) {
                const err: any = new Error('Application not found');
                err.statusCode = 404;
                throw err;
            }

            await trx('b2b_applications').where({ id }).update({ status });

            if (status === ApplicationStatus.APPROVED && application.status !== ApplicationStatus.APPROVED) {
                let customer = await trx('customers').where({ name: application.businessName }).first();
                if (!customer) {
                    const [customerId] = await trx('customers').insert({
                        name: application.businessName,
                        kraPin: application.kraPin,
                        phone: application.contactPhone,
                        address: 'N/A'
                    });
                    customer = { id: customerId };
                }

                const existingUser = await trx('users').where({ email: application.contactEmail }).first();
                if (!existingUser) {
                    await trx('users').insert({
                        id: uuidv4(),
                        name: application.contactName,
                        email: application.contactEmail,
                        passwordHash: application.passwordHash,
                        role: UserRole.B2B_CLIENT,
                        status: 'Active',
                        b2bApplicationId: application.id,
                        customerId: customer.id
                    });
                }
            }
            
            const b2bUser = await trx('users').where({ b2bApplicationId: id }).first();
            if (b2bUser) {
                await createNotification( b2bUser.id, `Your application for ${application.businessName} has been ${status}.`, '/b2b-portal', 'B2B_APP_STATUS_CHANGE', id, trx);
            }

            return { ...application, status };
        });
        res.json(updatedApp);
    } catch (error) { next(error); }
});

// --- Stock Requests (B2B Portal & Admin) ---
// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/stock-requests', V.validate(V.createStockRequestSchema), authorizeRole(UserRole.B2B_CLIENT), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { branchId, items } = req.body;
        const newRequest = await db.transaction(async trx => {
            const requestData = { b2bUserId: req.user!.id, branchId: branchId, status: StockRequestStatus.PENDING };
            const [requestId] = await trx('stock_requests').insert(requestData);
            
            for (const item of items) {
                const product = await trx('products').where({ id: item.productId }).first();
                if (!product) throw new Error(`Product with ID ${item.productId} not found.`);
                await trx('stock_request_items').insert({
                    stockRequestId: requestId, productId: item.productId, quantity: item.quantity,
                    wholesalePriceAtRequest: product.wholesalePrice
                });
            }
            await createAuditLog(req.user!.id, 'CREATE_STOCK_REQUEST', { requestId }, trx);
            
            const admins = await trx('users').whereIn('role', [UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]).select('id');
            for (const admin of admins) {
                await createNotification(admin.id, `New stock request REQ-${String(requestId).padStart(5, '0')} from ${req.user!.name}.`, '/b2b-management', 'NEW_STOCK_REQUEST', requestId, trx);
            }

            return { id: requestId, ...requestData, items };
        });
        await sendNotificationEmail('systems@masuma.africa', `New Stock Request from ${req.user!.name}`, generateNewStockRequestHtml(req.user!.name, newRequest.id));
        res.status(201).json(newRequest);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/stock-requests/my-requests', authorizeRole(UserRole.B2B_CLIENT), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const requests = await db('stock_requests')
            .join('branches', 'stock_requests.branchId', 'branches.id')
            .where({ b2bUserId: req.user!.id })
            .select('stock_requests.*', 'branches.name as branchName')
            .select(
                db.raw('(SELECT COUNT(*) FROM stock_request_items WHERE stock_request_items.stock_request_id = stock_requests.id) as itemCount'),
                db.raw('(SELECT SUM(quantity * wholesale_price_at_request) FROM stock_request_items WHERE stock_request_items.stock_request_id = stock_requests.id) as totalValue')
            )
            .orderBy('createdAt', 'desc');
        res.json(requests);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/stock-requests', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const requests = await db('stock_requests')
            .join('users', 'stock_requests.b2bUserId', 'users.id')
            .join('branches', 'stock_requests.branchId', 'branches.id')
            .select('stock_requests.*', 'users.name as userName', 'branches.name as branchName')
            .select(
                db.raw('(SELECT COUNT(*) FROM stock_request_items WHERE stock_request_items.stock_request_id = stock_requests.id) as itemCount'),
                db.raw('(SELECT SUM(quantity * wholesale_price_at_request) FROM stock_request_items WHERE stock_request_items.stock_request_id = stock_requests.id) as totalValue')
            )
            .orderBy('createdAt', 'desc');
        res.json(requests);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/stock-requests/:id', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER, UserRole.B2B_CLIENT]), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const request = await db('stock_requests')
            .join('users', 'stock_requests.b2bUserId', 'users.id')
            .join('branches', 'stock_requests.branchId', 'branches.id')
            .where('stock_requests.id', id)
            .select('stock_requests.*', 'users.name as userName', 'branches.name as branchName')
            .first();

        if (!request) return res.status(404).json({ message: 'Request not found.' });
        if (req.user!.role === UserRole.B2B_CLIENT && request.b2bUserId !== req.user!.id) {
            return res.status(403).json({ message: 'Forbidden.' });
        }

        const items = await db('stock_request_items')
            .join('products', 'stock_request_items.productId', 'products.id')
            .where({ stockRequestId: id })
            .select('stock_request_items.*', 'products.name as productName', 'products.partNumber as partNumber');
        
        res.json({ ...request, items });
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.patch('/api/stock-requests/:id/status', V.validate(V.updateStockRequestStatusSchema), authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const request = await db('stock_requests').where({ id }).first();
        if (!request) return res.status(404).json({ message: 'Request not found.' });
        
        await db.transaction(async trx => {
            await trx('stock_requests').where({ id }).update({ status });
            await createAuditLog(req.user!.id, 'UPDATE_STOCK_REQUEST_STATUS', { requestId: id, status }, trx);
            await createNotification(request.b2bUserId, `Your stock request REQ-${String(id).padStart(5, '0')} has been ${status}.`, '/b2b-portal', 'STOCK_REQUEST_STATUS_CHANGE', id, trx);
        });

        const updated = await db('stock_requests').where({ id }).first();
        res.json(updated);
    } catch (error) { next(error); }
});

// --- User Management ---
// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.get('/api/users', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const users = await db('users').select('id', 'name', 'email', 'role', 'status');
        res.json(users);
    } catch (error) { next(error); }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.post('/api/users', V.validate(V.createUserSchema), authorizeRole(UserRole.SYSTEM_ADMINISTRATOR), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { name, email, password, role, status } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);
        const userData = { id: uuidv4(), name, email, passwordHash: passwordHash, role, status };
        await db('users').insert(userData);
        await createAuditLog(req.user!.id, 'CREATE_USER', { userId: userData.id, email });
        res.status(201).json({ id: userData.id, name, email, role, status });
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A user with this email already exists.' });
        next(error);
    }
});

// FIX: Updated types to `express.Response` and `express.NextFunction`.
app.put('/api/users/:id', V.validate(V.updateUserSchema), authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]), async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const { password, ...updateData } = req.body;

        // B2B clients cannot be edited via this generic endpoint
        const userToUpdate = await db('users').where({ id }).first();
        if (userToUpdate && userToUpdate.role === UserRole.B2B_CLIENT) {
            return res.status(403).json({ message: 'B2B client data cannot be modified here.' });
        }

        if (password) {
            (updateData as any).passwordHash = await bcrypt.hash(password, 10);
        }

        await db('users').where({ id }).update(updateData);
        await createAuditLog(req.user!.id, 'UPDATE_USER', { userId: id, changes: Object.keys(updateData) });
        
        const updatedUser = await db('users').where({ id }).select('id', 'name', 'email', 'role', 'status').first();
        res.json(updatedUser);
    } catch (error) {
        next(error);
    }
});


// =================================================================
// --- STATIC SERVING & ERROR HANDLING (Must be at the end) ---
// =================================================================

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
}

// Custom Error Handler
// FIX: Updated types to `express.Request`, `express.Response`, and `express.NextFunction`.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({ message });
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
