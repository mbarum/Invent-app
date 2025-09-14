/// <reference types="node" />

// FIX: Importing Request, Response, and NextFunction from express to ensure correct type resolution against potential global DOM conflicts.
// MODIFIED: Changed import to only bring in NextFunction to avoid ambiguity with global Request/Response types. Will use express.Request and express.Response explicitly.
import express, { NextFunction } from 'express';
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
const app: express.Express = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`Uploads directory not found. Creating it at: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}


// --- TYPE AUGMENTATION ---
// FIX: Explicitly extend express.Request to avoid global type conflicts.
export interface AuthenticatedRequest extends express.Request {
  user?: User;
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });


// --- MIDDLEWARE ---
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// FIX: The B2B registration route uses multipart/form-data for file uploads.
// It must be defined BEFORE the general express.json() body parser to prevent
// the JSON parser from trying to handle the multipart stream, which causes a network error.
// MODIFIED: Use express.Request and express.Response for type safety.
app.post('/api/auth/register', upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), validate(registerSchema), async (req: express.Request, res: express.Response, next: NextFunction) => {
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
        res.status(201).json({ message: 'Application submitted successfully.' });
    } catch (error) { next(error); }
});


// General body parsers for JSON and URL-encoded data.
// These must come AFTER any routes that handle multipart data.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(UPLOADS_DIR));

// --- AUTH MIDDLEWARE ---
// FIX: Use express.Response and NextFunction from express to avoid global type conflicts.
// MODIFIED: Use express.Response for type safety.
const authenticate = async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
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

// FIX: Use express.Response and NextFunction from express to avoid global type conflicts.
// MODIFIED: Use express.Response for type safety.
const hasPermission = (permission: string) => (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
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

// --- REUSABLE BUSINESS LOGIC ---
const checkStockLevelAndNotify = async (productId: string, trx: Knex.Transaction) => {
    try {
        const product = await trx('products').where('id', productId).select('name', 'stock').first();
        if (!product) return;

        const settings = await getAppSettings(trx);
        const threshold = Number(settings.lowStockThreshold) || 10;

        if (product.stock > 0 && product.stock <= threshold) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const salesResult = await trx('sale_items')
                .where('product_id', productId)
                .andWhere('created_at', '>', thirtyDaysAgo)
                .sum('quantity as totalSold')
                .first();

            const totalSold = Number((salesResult as any)?.totalSold || 0);
            const recommendedReorder = Math.max(10, Math.ceil(totalSold * 1.2));

            const message = `Low stock for ${product.name} (${product.stock} left). Recommended reorder: ${recommendedReorder} units.`;

            const usersToNotify = await trx('users')
                .whereIn('role', [UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMINISTRATOR])
                .select('id');

            for (const user of usersToNotify) {
                const existing = await trx('notifications')
                    .where({
                        user_id: user.id,
                        type: 'LOW_STOCK',
                        entity_id: productId,
                        is_read: false
                    })
                    .first();

                if (!existing) {
                    await trx('notifications').insert({
                        user_id: user.id,
                        message,
                        link: '/inventory',
                        type: 'LOW_STOCK',
                        entity_id: productId,
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Failed to check stock level and send notification for product ${productId}:`, error);
    }
};

const finalizeSale = async (payload: MpesaTransactionPayload, trx: Knex.Transaction): Promise<SaleType> => {
    const { customerId, branchId, items, discountAmount, taxAmount, totalAmount, paymentMethod, invoiceId } = payload;
    
    const sale_no = `SALE-${Date.now()}`;
    
    const [saleId] = await trx('sales').insert({
        sale_no,
        customer_id: customerId,
        branch_id: branchId,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        invoice_id: invoiceId,
    });
    
    if (!saleId) {
        throw new Error('Failed to create sale or retrieve sale ID.');
    }
    
    const saleItems = items.map((item: any) => ({
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
    }));
    await trx('sale_items').insert(saleItems);

    for (const item of items) {
        await trx('products').where('id', item.productId).decrement('stock', item.quantity);
        await checkStockLevelAndNotify(item.productId, trx);
    }
    
    if (invoiceId) {
        await trx('invoices').where('id', invoiceId).update({ status: 'Paid', amount_paid: totalAmount });
    }

    const fullSale = await trx('sales as s')
        .join('customers as c', 's.customer_id', 'c.id')
        .join('branches as b', 's.branch_id', 'b.id')
        .where('s.id', saleId)
        .select('s.*', 'c.name as customerName', 'c.phone as customerPhone', 'b.name as branchName', 'b.address as branchAddress')
        .first();

    const fullItems = await trx('sale_items as si')
        .join('products as p', 'si.product_id', 'p.id')
        .where('si.sale_id', saleId)
        .select('si.*', 'p.name as productName', 'p.part_number as partNumber');

    return { ...fullSale, items: fullItems };
};


// --- API ROUTES ---

// --- Auth Routes ---
// FIX: Use express.Request, express.Response to avoid global type conflicts.
// MODIFIED: Use express.Request and express.Response for type safety.
app.post('/api/auth/login', validate(loginSchema), async (req: express.Request, res: express.Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const user = await db('users').where({ email }).first();
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        if (user.status === 'Inactive') {
            return res.status(403).json({ message: 'User account is inactive.' });
        }
        const token = jwt.sign({ userId: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Request and express.Response for type safety.
app.post('/api/auth/google', validate(googleLoginSchema), async (req: express.Request, res: express.Response, next: NextFunction) => {
    try {
        const { token: googleToken } = req.body;
        const ticket = await googleClient.verifyIdToken({ idToken: googleToken, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(400).json({ message: 'Invalid Google token.' });
        }
        let user = await db('users').where({ email: payload.email }).first();
        if (!user) {
            return res.status(404).json({ message: 'User not registered. Please sign up first.' });
        }
        const token = jwt.sign({ userId: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) { next(error); }
});

// --- Dashboard Routes ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/dashboard/stats', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { start, end, branchId } = req.query as { start: string, end: string, branchId: string };
        const startDate = new Date(start);
        const endDate = new Date(end);

        const salesQuery = db('sales').whereBetween('created_at', [startDate, endDate]);
        const shipmentsQuery = db('shipping_labels').whereBetween('created_at', [startDate, endDate]);

        if (branchId && branchId !== 'null' && branchId !== 'undefined') {
            salesQuery.andWhere('branch_id', branchId);
            shipmentsQuery.andWhere('from_branch_id', branchId);
        }

        const [totalRevenueResult, totalSalesResult, activeCustomersResult, totalShipments, pendingShipments, salesTargetResult] = await Promise.all([
            salesQuery.clone().sum('total_amount as total').first(),
            salesQuery.clone().count('id as count').first(),
            salesQuery.clone().distinct('customer_id').then(r => r.length),
            shipmentsQuery.clone().count('id as count').first(),
            shipmentsQuery.clone().whereNot('status', ShippingStatus.SHIPPED).count('id as count').first(),
            db('app_settings').where('setting_key', 'salesTarget').first(),
        ]);
        
        const stats: DashboardStats = {
            totalRevenue: Number((totalRevenueResult as any)?.total || 0),
            totalSales: Number((totalSalesResult as any)?.count || 0),
            activeCustomers: activeCustomersResult,
            totalShipments: Number((totalShipments as any)?.count || 0),
            pendingShipments: Number((pendingShipments as any)?.count || 0),
            salesTarget: Number(salesTargetResult?.setting_value || 5000000), // Default target
        };
        res.json(stats);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/dashboard/sales-chart', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { start, end, branchId } = req.query as { start: string, end: string, branchId: string };
        
        const query = db('sales')
            .select(
                db.raw('DATE(created_at) as name'),
                db.raw('COUNT(id) as sales'),
                db.raw('SUM(total_amount) as revenue')
            )
            .whereBetween('created_at', [new Date(start), new Date(end)])
            .groupBy('name')
            .orderBy('name', 'asc');
        
        if (branchId && branchId !== 'null' && branchId !== 'undefined') {
            query.andWhere('branch_id', branchId);
        }
            
        const data = await query;
        res.json(data);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/dashboard/fast-moving', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { start, end, branchId } = req.query as { start: string, end: string, branchId: string };

        const salesSubquery = db('sales')
            .whereBetween('created_at', [new Date(start), new Date(end)]);
        if (branchId && branchId !== 'null' && branchId !== 'undefined') {
            salesSubquery.andWhere('branch_id', branchId);
        }

        const productSales = await db('sale_items as si')
            .join(salesSubquery.as('s'), 'si.sale_id', 's.id')
            .join('products as p', 'si.product_id', 'p.id')
            .select('p.id', 'p.name', 'p.stock as currentStock')
            .sum('si.quantity as totalSold')
            .groupBy('p.id', 'p.name', 'p.stock')
            .orderBy('totalSold', 'desc')
            .limit(10);
            
        res.json(productSales);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.put('/api/dashboard/sales-target', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { target } = req.body;
        if (typeof target !== 'number' || target < 0) {
            return res.status(400).json({ message: "Invalid target value." });
        }
        await db('app_settings')
            .insert({ setting_key: 'salesTarget', setting_value: target.toString() })
            .onConflict('setting_key')
            .merge();
        await logAuditEvent(req.user!.id, 'UPDATE_SALES_TARGET', { newTarget: target });
        res.json({ salesTarget: target });
    } catch (error) { next(error); }
});


// --- Product Routes ---
// MODIFIED: Use express.Request and express.Response for type safety.
app.get('/api/products', async (req: express.Request, res: express.Response, next: NextFunction) => {
    try {
        const products = await db('products').select('id', 'part_number as partNumber', 'name', 'retail_price as retailPrice', 'wholesale_price as wholesalePrice', 'stock', 'notes');
        const oemNumbers = await db('product_oem_numbers').select('product_id', 'oem_number');
        const oemMap = oemNumbers.reduce((acc, { product_id, oem_number }) => {
            if (!acc[product_id]) acc[product_id] = [];
            acc[product_id].push(oem_number);
            return acc;
        }, {} as Record<string, string[]>);
        const productsWithOem = products.map(p => ({ ...p, oemNumbers: oemMap[p.id] || [] }));
        res.json(productsWithOem);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/products', authenticate, validate(productSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { oemNumbers, ...productData } = req.body;
        const id = uuidv4();
        await db.transaction(async trx => {
            await trx('products').insert({ id, ...productData });
            if (oemNumbers && oemNumbers.length > 0) {
                await trx('product_oem_numbers').insert(oemNumbers.map((oem: string) => ({ product_id: id, oem_number: oem })));
            }
            await logAuditEvent(req.user!.id, 'CREATE_PRODUCT', { productId: id, partNumber: productData.partNumber }, trx);
        });
        res.status(201).json({ id, ...req.body });
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.put('/api/products/:id', authenticate, validate(updateProductSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { oemNumbers, ...productData } = req.body;
        await db.transaction(async trx => {
            if (Object.keys(productData).length > 0) {
                await trx('products').where({ id }).update(productData);
            }
            if (oemNumbers) {
                await trx('product_oem_numbers').where({ product_id: id }).del();
                if (oemNumbers.length > 0) {
                    await trx('product_oem_numbers').insert(oemNumbers.map((oem: string) => ({ product_id: id, oem_number: oem })));
                }
            }
            await logAuditEvent(req.user!.id, 'UPDATE_PRODUCT', { productId: id, changes: req.body }, trx);

            if ('stock' in productData) {
                await checkStockLevelAndNotify(id, trx);
            }
        });
        res.json({ id, ...req.body });
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.delete('/api/products/:id', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        await db.transaction(async trx => {
            const saleItemsCount = await trx('sale_items').where('product_id', id).count({ count: '*' }).first();
            const invoiceItemsCount = await trx('invoice_items').where('product_id', id).count({ count: '*' }).first();
            const quotationItemsCount = await trx('quotation_items').where('product_id', id).count({ count: '*' }).first();
            const stockRequestItemsCount = await trx('stock_request_items').where('product_id', id).count({ count: '*' }).first();

            const totalReferences = 
                Number(saleItemsCount?.count || 0) + 
                Number(invoiceItemsCount?.count || 0) + 
                Number(quotationItemsCount?.count || 0) +
                Number(stockRequestItemsCount?.count || 0);

            if (totalReferences > 0) {
                const err: any = new Error('This product cannot be deleted. It is referenced in existing sales, invoices, quotations, or stock requests.');
                err.statusCode = 400;
                throw err;
            }
            
            const product = await trx('products').where({ id }).first();
            if (!product) {
                 const err: any = new Error('Product not found.');
                 err.statusCode = 404;
                 throw err;
            }

            await trx('product_oem_numbers').where({ product_id: id }).del();
            const deleteCount = await trx('products').where({ id }).del();

            if (deleteCount === 0) {
                 const err: any = new Error('Product not found.');
                 err.statusCode = 404;
                 throw err;
            }
            
            await logAuditEvent(req.user!.id, 'DELETE_PRODUCT', { productId: id, partNumber: product.part_number }, trx);
        });

        res.status(204).send();
    } catch (error) { 
        next(error); 
    }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/products/import', authenticate, validate(Joi.object({ products: bulkProductSchema })), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { products } = req.body;
        await db('products').insert(products).onConflict('part_number').merge();
        res.json({ count: products.length });
    } catch (error) { next(error); }
});

// --- B2B Routes ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/b2b/applications', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const applications = await db('b2b_applications')
            .select(
                'id',
                'business_name as businessName',
                'kra_pin as kraPin',
                'contact_name as contactName',
                'contact_email as contactEmail',
                'contact_phone as contactPhone',
                'cert_of_inc_url as certOfIncUrl',
                'cr12_url as cr12Url',
                'status',
                'submitted_at as submittedAt'
            )
            .orderBy('submitted_at', 'desc');
        res.json(applications);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.patch('/api/b2b/applications/:id', authenticate, validate(updateB2BStatusSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        await db.transaction(async trx => {
            const application = await trx('b2b_applications').where({ id }).first();
            if (!application) {
                return res.status(404).json({ message: 'Application not found.' });
            }

            await trx('b2b_applications').where({ id }).update({ status });
            
            if (status === ApplicationStatus.APPROVED) {
                const existingUser = await trx('users').where('email', application.contact_email).first();
                if (existingUser) {
                    await trx('users').where('id', existingUser.id).update({
                        role: UserRole.B2B_CLIENT,
                        b2b_application_id: application.id,
                        status: 'Active',
                    });
                } else {
                    const newCustomer = {
                        name: application.business_name,
                        phone: application.contact_phone,
                        kra_pin: application.kra_pin,
                    };
                    const [customerId] = await trx('customers').insert(newCustomer);

                    await trx('users').insert({
                        id: uuidv4(),
                        name: application.contact_name,
                        email: application.contact_email,
                        password_hash: application.password_hash,
                        role: UserRole.B2B_CLIENT,
                        b2b_application_id: application.id,
                        customer_id: customerId,
                        status: 'Active'
                    });
                }
            }
            await logAuditEvent(req.user!.id, 'UPDATE_B2B_APP_STATUS', { applicationId: id, newStatus: status }, trx);
        });

        res.json({ id, status });
    } catch (error) { next(error); }
});

// --- Stock Requests ---
// MODIFIED: Use express.Response for type safety.
app.post('/api/stock-requests', authenticate, validate(createStockRequestSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        if (req.user?.role !== UserRole.B2B_CLIENT) {
            return res.status(403).json({ message: 'Only B2B clients can create stock requests.' });
        }
        
        const { branchId, items } = req.body;

        await db.transaction(async trx => {
            const [requestId] = await trx('stock_requests').insert({
                b2b_user_id: req.user!.id,
                branch_id: branchId,
                status: StockRequestStatus.PENDING,
            });

            const productIds = items.map((item: any) => item.productId);
            const products = await trx('products').whereIn('id', productIds).select('id', 'wholesale_price');
            const priceMap = products.reduce((acc: any, p: any) => {
                acc[p.id] = p.wholesale_price;
                return acc;
            }, {});

            const requestItems = items.map((item: any) => ({
                stock_request_id: requestId,
                product_id: item.productId,
                quantity: item.quantity,
                wholesale_price_at_request: priceMap[item.productId],
            }));

            await trx('stock_request_items').insert(requestItems);
        });

        res.status(201).json({ message: 'Stock request created successfully.' });
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/stock-requests/my-requests', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const requests = await db('stock_requests as sr')
            .join('branches as b', 'sr.branch_id', 'b.id')
            .where('b2b_user_id', req.user!.id)
            .select('sr.*', 'b.name as branchName')
            .orderBy('sr.created_at', 'desc');
        res.json(requests);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/stock-requests', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const requests = await db('stock_requests as sr')
            .join('branches as b', 'sr.branch_id', 'b.id')
            .join('users as u', 'sr.b2b_user_id', 'u.id')
            .select('sr.*', 'b.name as branchName', 'u.name as userName')
            .orderBy('sr.created_at', 'desc');
        res.json(requests);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/stock-requests/:id', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const request = await db('stock_requests').where({ id }).first();
        if (!request) return res.status(404).json({ message: 'Request not found.' });

        const items = await db('stock_request_items as sri')
            .join('products as p', 'sri.product_id', 'p.id')
            .where('sri.stock_request_id', id)
            .select('sri.*', 'p.name as productName', 'p.part_number as partNumber');
        
        res.json({ ...request, items });
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.patch('/api/stock-requests/:id/status', authenticate, validate(updateStockRequestStatusSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db('stock_requests').where({ id }).update({ status });
        await logAuditEvent(req.user!.id, 'UPDATE_STOCK_REQ_STATUS', { requestId: id, newStatus: status });
        res.json({ id, status });
    } catch (error) { next(error); }
});

// --- Customer Routes ---
// MODIFIED: Use express.Request and express.Response for type safety.
app.get('/api/customers', async (req: express.Request, res: express.Response, next: NextFunction) => {
    try {
        const customers = await db('customers').select(
            'id', 'name', 'address', 'phone', 'kra_pin as kraPin'
        );
        res.json(customers);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/customers', authenticate, validate(createCustomerSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const [id] = await db('customers').insert(req.body);
        res.status(201).json({ id, ...req.body });
    } catch(error) { next(error); }
});

// FIX: Added new endpoint to fetch all transactions for a specific customer.
// MODIFIED: Use express.Response for type safety.
app.get('/api/customers/:id/transactions', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const [sales, invoices, quotations] = await Promise.all([
            db('sales').where('customer_id', id).orderBy('created_at', 'desc'),
            db('invoices').where('customer_id', id).orderBy('created_at', 'desc'),
            db('quotations').where('customer_id', id).orderBy('created_at', 'desc'),
        ]);
        res.json({ sales, invoices, quotations });
    } catch(error) { next(error); }
});

// --- Sales Routes ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/sales', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const query = db('sales')
            .select('id', 'sale_no', 'customer_id', 'branch_id', 'total_amount as totalAmount', 'payment_method', 'created_at')
            .count('sale_items.id as items')
            .leftJoin('sale_items', 'sales.id', 'sale_items.sale_id')
            .groupBy('sales.id')
            .orderBy('sales.created_at', 'desc');

        if(req.query.start && req.query.end) {
            query.whereBetween('sales.created_at', [new Date(req.query.start as string), new Date(req.query.end as string)]);
        }
        
        const sales = await query;
        res.json(sales);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/sales', authenticate, validate(createSaleSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const sale = await db.transaction(async trx => {
            return await finalizeSale(req.body, trx);
        });
        await logAuditEvent(req.user!.id, 'CREATE_SALE', { saleNo: sale.sale_no, total: sale.totalAmount });
        res.status(201).json(sale);
    } catch(error) { next(error); }
});

// --- Quotations/Invoices Routes ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/quotations', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const quotations = await db('quotations as q')
            .join('customers as c', 'q.customer_id', 'c.id')
            .select('q.id', 'q.quotation_no', 'q.customer_id', 'c.name as customerName', 'q.valid_until', 'q.total_amount as totalAmount', 'q.status', 'q.created_at')
            .orderBy('q.created_at', 'desc');
        res.json(quotations);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/quotations/:id', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const quotation = await db('quotations').where({ id }).first();
        if (!quotation) return res.status(404).json({ message: 'Quotation not found.' });

        const [items, customer, branch] = await Promise.all([
            db('quotation_items as qi').join('products as p', 'qi.product_id', 'p.id').where('qi.quotation_id', id).select('qi.*', 'p.name as product_name', 'p.part_number'),
            db('customers').where('id', quotation.customer_id).first(),
            db('branches').where('id', quotation.branch_id).first(),
        ]);
        
        res.json({ ...quotation, totalAmount: quotation.total_amount, items, customer, branch });
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/quotations', authenticate, validate(createQuotationSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { customerId, branchId, items, validUntil } = req.body;
        const quotation_no = `QUO-${Date.now()}`;
        const totalAmount = items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0);

        const newQuotation = await db.transaction(async trx => {
            const [id] = await trx('quotations').insert({
                quotation_no, customer_id: customerId, branch_id: branchId, valid_until: validUntil,
                total_amount: totalAmount, status: QuotationStatus.DRAFT
            });
            const quoteItems = items.map((item: any) => ({
                quotation_id: id, product_id: item.productId, quantity: item.quantity, unit_price: item.unitPrice
            }));
            await trx('quotation_items').insert(quoteItems);
            return { id, quotation_no, customerId, branchId, valid_until: validUntil, totalAmount, status: QuotationStatus.DRAFT, created_at: new Date().toISOString() };
        });
        await logAuditEvent(req.user!.id, 'CREATE_QUOTATION', { quotationNo: newQuotation.quotation_no, total: newQuotation.totalAmount });
        res.status(201).json(newQuotation);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.patch('/api/quotations/:id/status', authenticate, validate(updateQuotationStatusSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db('quotations').where({ id }).update({ status });
        await logAuditEvent(req.user!.id, 'UPDATE_QUOTATION_STATUS', { quotationId: id, newStatus: status });
        res.json({ id, status });
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/quotations/:id/convert-to-invoice', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const newInvoice = await db.transaction(async trx => {
            const quotation = await trx('quotations').where({ id }).first();
            if (!quotation || quotation.status !== QuotationStatus.ACCEPTED) {
                const err: any = new Error('Only accepted quotations can be converted.');
                err.statusCode = 400;
                throw err;
            }
            
            const invoice_no = `INV-${Date.now()}`;
            const settings = await getAppSettings(trx);
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (settings.invoiceDueDays || 30));

            const [invoiceId] = await trx('invoices').insert({
                invoice_no, customer_id: quotation.customer_id, branch_id: quotation.branch_id,
                quotation_id: quotation.id, due_date: dueDate, total_amount: quotation.total_amount, status: InvoiceStatus.UNPAID
            });
            
            const quoteItems = await trx('quotation_items').where({ quotation_id: id });
            const invoiceItems = quoteItems.map(item => ({
                invoice_id: invoiceId, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price
            }));
            await trx('invoice_items').insert(invoiceItems);
            await trx('quotations').where({ id }).update({ status: QuotationStatus.INVOICED });

            return { id: invoiceId, invoice_no, totalAmount: quotation.total_amount };
        });
        await logAuditEvent(req.user!.id, 'CONVERT_QUOTATION_TO_INVOICE', { quotationId: id, invoiceNo: newInvoice.invoice_no });
        res.status(201).json(newInvoice);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/invoices', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const query = db('invoices as i')
            .join('customers as c', 'i.customer_id', 'c.id')
            .select('i.id', 'i.invoice_no', 'c.name as customerName', 'i.due_date', 'i.total_amount as totalAmount', 'i.status', 'i.created_at')
            .orderBy('i.created_at', 'desc');

        if(req.query.status) {
            query.where('i.status', req.query.status as string);
        }
        
        const invoices = await query;
        res.json(invoices);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/invoices/snippets/unpaid', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const invoices = await db('invoices').where('status', InvoiceStatus.UNPAID).select('id', 'invoice_no').orderBy('created_at', 'desc');
        res.json(invoices);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/invoices/:id', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const invoice = await db('invoices').where({ id }).first();
        if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

        const [items, customer, branch] = await Promise.all([
            db('invoice_items as ii').join('products as p', 'ii.product_id', 'p.id').where('ii.invoice_id', id).select('ii.*', 'p.name as product_name', 'p.part_number'),
            db('customers').where('id', invoice.customer_id).first(),
            db('branches').where('id', invoice.branch_id).first(),
        ]);
        
        res.json({ ...invoice, totalAmount: invoice.total_amount, items, customer, branch });
    } catch(error) { next(error); }
});

// --- Shipping Routes ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/shipping', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const labels = await db('shipping_labels').orderBy('created_at', 'desc');
        res.json(labels);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/shipping', authenticate, validate(createLabelSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const id = uuidv4();
        await db('shipping_labels').insert({ id, ...req.body, status: ShippingStatus.DRAFT });
        res.status(201).json({ id, ...req.body, status: ShippingStatus.DRAFT, created_at: new Date().toISOString() });
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.patch('/api/shipping/:id/status', authenticate, validate(updateLabelStatusSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db('shipping_labels').where({ id }).update({ status });
        res.json({ id, status });
    } catch(error) { next(error); }
});


// --- User Routes ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/users', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const users = await db('users').select('id', 'name', 'email', 'role', 'status').orderBy('name');
        res.json(users);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/users', authenticate, validate(createUserSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { name, email, password, role, status } = req.body;
        const password_hash = await bcrypt.hash(password, 10);
        const id = uuidv4();
        await db('users').insert({ id, name, email, password_hash, role, status: status || 'Active' });
        await logAuditEvent(req.user!.id, 'CREATE_USER', { userId: id, name, email, role });
        res.status(201).json({ id, name, email, role, status });
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.put('/api/users/:id', authenticate, validate(updateUserSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await db('users').where({ id }).update(req.body);
        await logAuditEvent(req.user!.id, 'UPDATE_USER', { userId: id, changes: req.body });
        res.json({ id, ...req.body });
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.patch('/api/users/me/password', authenticate, validate(updatePasswordSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await db('users').where({ id: req.user!.id }).first();

        if (!user.password_hash || !(await bcrypt.compare(currentPassword, user.password_hash))) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }
        
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db('users').where({ id: req.user!.id }).update({ password_hash: newPasswordHash });
        await logAuditEvent(req.user!.id, 'UPDATE_OWN_PASSWORD', { userId: req.user!.id });
        res.status(204).send();
    } catch (error) { next(error); }
});

// --- Branch Routes ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/branches', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const branches = await db('branches').select('*');
        res.json(branches);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/branches', authenticate, validate(createBranchSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const [id] = await db('branches').insert(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.put('/api/branches/:id', authenticate, validate(updateBranchSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await db('branches').where({ id }).update(req.body);
        res.json({ id, ...req.body });
    } catch (error) { next(error); }
});

// --- Settings Routes ---
const getAppSettings = async (trx?: Knex.Transaction): Promise<Partial<AppSettings>> => {
    const dbInstance = trx || db;
    const settingsRows = await dbInstance('app_settings').select('*');
    return settingsRows.reduce((acc, row) => {
        acc[row.setting_key as keyof AppSettings] = row.setting_value;
        return acc;
    }, {} as Partial<AppSettings>);
};

// MODIFIED: Use express.Response for type safety.
app.get('/api/settings', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const settings = await getAppSettings();
        res.json(settings);
    } catch (error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.put('/api/settings', authenticate, validate(updateSettingsSchema), async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const settings: AppSettings = req.body;
        await db.transaction(async trx => {
            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined) {
                    await trx('app_settings')
                        .insert({ setting_key: key, setting_value: String(value) })
                        .onConflict('setting_key')
                        .merge();
                }
            }
        });
        await logAuditEvent(req.user!.id, 'UPDATE_SETTINGS', { updatedKeys: Object.keys(settings) });
        res.json(settings);
    } catch (error) { next(error); }
});

// --- VIN Picker ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/vin/:vin', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    // This is a placeholder for a real VIN lookup service API call
    // In a real app, you would call an external API here.
    try {
        const { vin } = req.params;
        // Mock response
        const mockResults: Product[] = await db('products').limit(5);
        res.json(mockResults.map(p => ({
            partNumber: p.part_number,
            name: p.name,
            compatibility: `Compatible with ${vin.slice(0, 8)}...`,
            stock: p.stock
        })));
    } catch(error) { next(error); }
});

// --- Reports ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/reports/shipments', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { start, end } = req.query as { start: string, end: string };
        const shipments = await db('shipping_labels').whereBetween('created_at', [new Date(start), new Date(end)]);
        res.json(shipments);
    } catch(error) { next(error); }
});

// --- Audit Log ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/audit-logs', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 15;
        const offset = (page - 1) * limit;

        const logsQuery = db('audit_logs as a')
            .join('users as u', 'a.user_id', 'u.id')
            .select('a.*', 'u.name as userName')
            .orderBy('a.created_at', 'desc')
            .limit(limit)
            .offset(offset);
        
        const totalQuery = db('audit_logs').count({ total: '*' }).first();

        const [logs, totalResult] = await Promise.all([logsQuery, totalQuery]);

        res.json({ logs, total: (totalResult as any).total });
    } catch(error) { next(error); }
});


// --- Notifications ---
// MODIFIED: Use express.Response for type safety.
app.get('/api/notifications', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const userAlerts = await db('notifications')
            .where('user_id', req.user!.id)
            .orderBy('created_at', 'desc')
            .limit(20);

        const response: NotificationPayload = {
            serverTimestamp: new Date().toISOString(),
            newApplications: [], // These are now handled by notifications
            lowStockProducts: [],
            userAlerts: userAlerts,
        };
        res.json(response);
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Response for type safety.
app.post('/api/notifications/mark-read', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty IDs array.' });
        }
        await db('notifications')
            .where('user_id', req.user!.id)
            .whereIn('id', ids)
            .update({ is_read: true });
        res.status(204).send();
    } catch (error) { next(error); }
});

// --- M-Pesa Routes ---
// Placeholder for getMpesaToken function
const getMpesaToken = async (settings: Partial<AppSettings>): Promise<string> => {
    const { mpesaConsumerKey, mpesaConsumerSecret, mpesaEnvironment } = settings;
    if (!mpesaConsumerKey || !mpesaConsumerSecret) throw new Error("M-Pesa credentials not configured.");

    const url = mpesaEnvironment === 'live'
        ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    const auth = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64');
    const { data } = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    return data.access_token;
};

// MODIFIED: Use express.Response for type safety.
app.post('/api/mpesa/stk-push', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { amount, phoneNumber, ...salePayload } = req.body;
        const settings = await getAppSettings();

        const token = await getMpesaToken(settings);
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${settings.mpesaPaybill}${settings.mpesaPasskey}${timestamp}`).toString('base64');
        
        const url = settings.mpesaEnvironment === 'live'
            ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
            : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

        const response = await axios.post(url, {
            BusinessShortCode: settings.mpesaPaybill,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline", // or "CustomerBuyGoodsOnline"
            Amount: Math.round(amount), // Amount must be an integer
            PartyA: phoneNumber,
            PartyB: settings.mpesaPaybill,
            PhoneNumber: phoneNumber,
            CallBackURL: `${process.env.BACKEND_URL}/api/mpesa/callback`,
            AccountReference: "MasumaEA",
            TransactionDesc: "Payment for goods"
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        const { CheckoutRequestID, MerchantRequestID } = response.data;
        
        // Store the transaction details for later verification
        await db('mpesa_transactions').insert({
            checkout_request_id: CheckoutRequestID,
            merchant_request_id: MerchantRequestID,
            amount,
            phone_number: phoneNumber,
            status: 'Pending',
            transaction_details: JSON.stringify(salePayload), // Store the sale payload
        });

        res.json({ checkoutRequestId: CheckoutRequestID });
    } catch (error: any) {
        console.error("M-Pesa STK Push error:", error.response?.data || error.message);
        next(new Error(error.response?.data?.errorMessage || 'Failed to initiate M-Pesa payment.'));
    }
});

// MODIFIED: Use express.Response for type safety.
app.get('/api/mpesa/status/:checkoutRequestId', authenticate, async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    try {
        const { checkoutRequestId } = req.params;
        const transaction = await db('mpesa_transactions').where({ checkout_request_id: checkoutRequestId }).first();
        if (!transaction) return res.status(404).json({ message: "Transaction not found." });
        
        if (transaction.status === 'Completed' && transaction.sale_id) {
            const sale = await db('sales as s')
                .join('customers as c', 's.customer_id', 'c.id')
                .join('branches as b', 's.branch_id', 'b.id')
                .where('s.id', transaction.sale_id)
                .select('s.*', 'c.name as customerName', 'c.phone as customerPhone', 'b.name as branchName', 'b.address as branchAddress')
                .first();

            const items = await db('sale_items as si')
                .join('products as p', 'si.product_id', 'p.id')
                .where('si.sale_id', transaction.sale_id)
                .select('si.*', 'p.name as productName', 'p.part_number as partNumber');

            res.json({ status: 'Completed', sale: { ...sale, items } });
        } else if (transaction.status === 'Failed') {
            res.json({ status: 'Failed', message: transaction.result_desc });
        } else {
            res.json({ status: 'Pending' });
        }
    } catch(error) { next(error); }
});

// MODIFIED: Use express.Request and express.Response for type safety.
app.post('/api/mpesa/callback', async (req: express.Request, res: express.Response) => {
    console.log('M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));
    const { Body: { stkCallback } } = req.body;
    
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    try {
        if (ResultCode === 0) { // Success
            const mpesaReceipt = CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
            
            await db.transaction(async trx => {
                const transaction = await trx('mpesa_transactions')
                    .where({ checkout_request_id: CheckoutRequestID })
                    .first();
                    
                if (!transaction || transaction.status !== 'Pending') {
                    console.log(`Transaction ${CheckoutRequestID} not found or already processed.`);
                    return; // Avoid double processing
                }

                const salePayload: MpesaTransactionPayload = JSON.parse(transaction.transaction_details);
                const sale = await finalizeSale(salePayload, trx);

                await trx('mpesa_transactions')
                    .where({ checkout_request_id: CheckoutRequestID })
                    .update({
                        status: 'Completed',
                        result_desc: 'Transaction completed successfully.',
                        mpesa_receipt_number: mpesaReceipt,
                        sale_id: sale.id
                    });
            });
        } else { // Failure
            await db('mpesa_transactions')
                .where({ checkout_request_id: CheckoutRequestID })
                .update({ status: 'Failed', result_desc: ResultDesc });
        }
        res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (error) {
        console.error("Error processing M-Pesa callback:", error);
        res.status(500).json({ ResultCode: 1, ResultDesc: "Internal Server Error" });
    }
});


// --- SERVE FRONTEND ---
const FRONTEND_PATH = path.join(__dirname, '../../frontend/dist');
app.use(express.static(FRONTEND_PATH));
app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// --- GLOBAL ERROR HANDLER ---
// FIX: Use express.Request, express.Response, and NextFunction to avoid global type conflicts.
// MODIFIED: Use express types for safety.
app.use((err: any, req: express.Request, res: express.Response, next: NextFunction) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({ message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
});

export default app;