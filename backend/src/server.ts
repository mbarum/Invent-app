/// <reference types="node" />

// FIX: Change import to use express namespace and avoid global type conflicts.
// FIX: Added explicit Request, Response, NextFunction imports to resolve global type conflicts.
import express, { Request, Response, NextFunction } from 'express';
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
// FIX: Import Joi for validation schema creation.
import Joi from 'joi';
import axios from 'axios';

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
    // FIX: Import StockRequestStatus enum.
    StockRequestStatus,
    MpesaTransactionPayload,
    Sale as SaleType,
    // FIX: Add missing type imports for new endpoints.
    DashboardStats,
    ShippingStatus,
    InvoiceStatus
} from '@masuma-ea/types';


// --- SETUP ---
dotenv.config();
const app: express.Express = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// --- TYPE AUGMENTATION ---
// Adds the `user` property to the Express Request type after authentication.
// FIX: Extended express.Request to resolve conflicts with global Request type.
export interface AuthenticatedRequest extends Request {
  user?: User;
}


// --- MIDDLEWARE ---
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded documents
// In a CommonJS module environment (as configured in tsconfig.json),
// __dirname is a global variable, so we can use it directly.
const UPLOADS_DIR = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });


// --- AUTH MIDDLEWARE ---
// FIX: Use explicit express types for middleware signature to resolve global type conflicts.
const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication token required.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        // Fetch full user details to attach to request
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

// FIX: Use explicit express types for middleware signature to resolve global type conflicts.
const hasPermission = (permission: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // This is a placeholder for a real permission system (e.g., Casl, custom logic).
    // For now, we'll allow admins to do everything.
    if (req.user?.role === UserRole.SYSTEM_ADMINISTRATOR) {
        return next();
    }
    // A more complex check would go here based on the `permission` string
    // For now, we'll deny by default for non-admins if a permission is required.
    // In a real app, you would import your ROLES config and check against it.
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

/**
 * Proactively checks stock levels after a change, calculates sales velocity, and notifies
 * relevant managers if stock is below the configured threshold.
 * @param productId The ID of the product to check.
 * @param trx The current database transaction.
 */
const checkStockLevelAndNotify = async (productId: string, trx: Knex.Transaction) => {
    try {
        const product = await trx('products').where('id', productId).select('name', 'stock').first();
        if (!product) return;

        const settings = await getAppSettings(trx);
        const threshold = Number(settings.lowStockThreshold) || 10;

        // Only trigger if stock is positive but below or at the threshold
        if (product.stock > 0 && product.stock <= threshold) {
            // Calculate sales velocity over the last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const salesResult = await trx('sale_items')
                .where('product_id', productId)
                .andWhere('created_at', '>', thirtyDaysAgo)
                .sum('quantity as totalSold')
                .first();

            const totalSold = Number((salesResult as any)?.totalSold || 0);
            // Recommend reordering enough for the next month, plus a 20% buffer, with a minimum of 10.
            const recommendedReorder = Math.max(10, Math.ceil(totalSold * 1.2));

            const message = `Low stock for ${product.name} (${product.stock} left). Recommended reorder: ${recommendedReorder} units.`;

            // Notify Inventory Managers and Admins
            const usersToNotify = await trx('users')
                .whereIn('role', [UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMINISTRATOR])
                .select('id');

            for (const user of usersToNotify) {
                // Prevent sending duplicate unread notifications for the same product
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
        // Log the error but don't let it fail the parent transaction (e.g., a sale)
        console.error(`Failed to check stock level and send notification for product ${productId}:`, error);
    }
};

/**
 * Creates a sale, its items, decrements stock, and updates invoice status in a single transaction.
 * @param payload - The data required to create a sale.
 * @param trx - The Knex transaction object.
 * @returns The full sale object with its items for receipt printing.
 */
const finalizeSale = async (payload: MpesaTransactionPayload, trx: Knex.Transaction): Promise<SaleType> => {
    const { customerId, branchId, items, discountAmount, taxAmount, totalAmount, paymentMethod, invoiceId } = payload;
    
    const sale_no = `SALE-${Date.now()}`;
    const [sale] = await trx('sales').insert({
        sale_no,
        customer_id: customerId,
        branch_id: branchId,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        invoice_id: invoiceId,
    }).returning('*');
    
    const saleItems = items.map((item: any) => ({
        sale_id: sale.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
    }));
    await trx('sale_items').insert(saleItems);

    for (const item of items) {
        await trx('products').where('id', item.productId).decrement('stock', item.quantity);
        // After decrementing, check stock level and notify if necessary
        await checkStockLevelAndNotify(item.productId, trx);
    }
    
    if (invoiceId) {
        await trx('invoices').where('id', invoiceId).update({ status: 'Paid', amount_paid: totalAmount });
    }

    const fullSale = await trx('sales as s')
        .join('customers as c', 's.customer_id', 'c.id')
        .join('branches as b', 's.branch_id', 'b.id')
        .where('s.id', sale.id)
        .select('s.*', 'c.name as customerName', 'c.phone as customerPhone', 'b.name as branchName', 'b.address as branchAddress')
        .first();

    const fullItems = await trx('sale_items as si')
        .join('products as p', 'si.product_id', 'p.id')
        .where('si.sale_id', sale.id)
        .select('si.*', 'p.name as productName', 'p.part_number as partNumber');

    return { ...fullSale, items: fullItems };
};


// --- API ROUTES ---

// --- Auth Routes ---
// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/auth/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
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

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/auth/google', validate(googleLoginSchema), async (req: Request, res: Response, next: NextFunction) => {
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

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/auth/register', upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const certOfIncUrl = files['certOfInc'][0].path;
        const cr12Url = files['cr12'][0].path;
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

// --- Dashboard Routes ---
// FIX: Add missing dashboard data endpoints.
app.get('/api/dashboard/stats', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

app.get('/api/dashboard/sales-chart', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

app.get('/api/dashboard/fast-moving', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

app.put('/api/dashboard/sales-target', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/products', async (req: Request, res: Response, next: NextFunction) => {
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

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/products', authenticate, validate(productSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// FIX: Use explicit express types to resolve global type conflicts.
app.put('/api/products/:id', authenticate, validate(updateProductSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

            // If stock was part of the update, trigger a check
            if ('stock' in productData) {
                await checkStockLevelAndNotify(id, trx);
            }
        });
        res.json({ id, ...req.body });
    } catch (error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.delete('/api/products/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const product = await db('products').where({ id }).first();
        if (!product) return res.status(404).json({ message: 'Product not found' });

        await db('products').where({ id }).del();
        await logAuditEvent(req.user!.id, 'DELETE_PRODUCT', { productId: id, partNumber: product.part_number });
        res.status(204).send();
    } catch (error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/products/import', authenticate, validate(Joi.object({ products: bulkProductSchema })), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // A simplified import that updates on conflict.
    try {
        const { products } = req.body;
        await db('products').insert(products).onConflict('part_number').merge();
        // FIX: Replaced unsupported 'rowCount' with the length of the input array for a more reliable count.
        res.json({ count: products.length });
    } catch (error) { next(error); }
});

// --- B2B Routes ---
// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/b2b/applications', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const applications = await db('b2b_applications').select(
            'id', 'business_name as businessName', 'kra_pin as kraPin', 'contact_name as contactName',
            'contact_email as contactEmail', 'contact_phone as contactPhone', 'cert_of_inc_url as certOfIncUrl',
            'cr12_url as cr12Url', 'status', 'submitted_at as submittedAt'
        );
        res.json(applications);
    } catch (error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.patch('/api/b2b/applications/:id', authenticate, validate(updateB2BStatusSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const [application] = await db('b2b_applications').where({ id }).update({ status }).returning('*');

        if (status === ApplicationStatus.APPROVED) {
            // Create user account
            const newUser = {
                id: uuidv4(),
                name: application.contact_name,
                email: application.contact_email,
                password_hash: application.password_hash,
                role: UserRole.B2B_CLIENT,
                b2b_application_id: id,
                status: 'Active'
            };
            await db('users').insert(newUser);
            await logAuditEvent(req.user!.id, 'APPROVE_B2B_APP', { applicationId: id, businessName: application.business_name });
        } else {
            await logAuditEvent(req.user!.id, 'REJECT_B2B_APP', { applicationId: id, businessName: application.business_name });
        }

        res.json({ ...application, status });
    } catch (error) { next(error); }
});

// --- Stock Requests (B2B) ---
// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/stock-requests', authenticate, validate(createStockRequestSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { branchId, items } = req.body;
        const userId = req.user!.id;
        
        const products = await db('products').whereIn('id', items.map((i: any) => i.productId)).select('id', 'wholesale_price');
        const productPriceMap = products.reduce((acc, p) => { acc[p.id] = p.wholesale_price; return acc; }, {} as Record<string, number>);

        const newRequestId = await db.transaction(async trx => {
            const [insertedRequest] = await trx('stock_requests').insert({
                b2b_user_id: userId,
                branch_id: branchId,
                status: StockRequestStatus.PENDING,
            }).returning('id');
            const requestId = insertedRequest.id;

            const requestItems = items.map((item: any) => ({
                stock_request_id: requestId,
                product_id: item.productId,
                quantity: item.quantity,
                wholesale_price_at_request: productPriceMap[item.productId]
            }));
            await trx('stock_request_items').insert(requestItems);
            return requestId;
        });

        res.status(201).json({ id: newRequestId, ...req.body });
    } catch(error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/stock-requests/my-requests', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const requests = await db('stock_requests as sr')
            .join('branches as b', 'sr.branch_id', 'b.id')
            .where('sr.b2b_user_id', req.user!.id)
            .orderBy('sr.created_at', 'desc')
            .select('sr.*', 'b.name as branchName');
        res.json(requests);
    } catch(error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/stock-requests', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const requests = await db('stock_requests as sr')
            .join('users as u', 'sr.b2b_user_id', 'u.id')
            .join('branches as b', 'sr.branch_id', 'b.id')
            .orderBy('sr.created_at', 'desc')
            .select('sr.*', 'u.name as userName', 'b.name as branchName');
        res.json(requests);
    } catch(error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/stock-requests/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const request = await db('stock_requests').where({ id }).first();
        if (!request) return res.status(404).send();
        
        const items = await db('stock_request_items as sri')
            .join('products as p', 'sri.product_id', 'p.id')
            .where('sri.stock_request_id', id)
            .select('sri.*', 'p.name as productName', 'p.part_number as partNumber');
        
        res.json({ ...request, items });
    } catch(error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.patch('/api/stock-requests/:id/status', authenticate, validate(updateStockRequestStatusSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const [requestBeforeUpdate] = await db('stock_requests').where({ id }).select('b2b_user_id');
        if (!requestBeforeUpdate) {
            return res.status(404).json({ message: 'Stock request not found.' });
        }
        
        const [updatedRequest] = await db('stock_requests').where({ id }).update({ status }).returning('*');

        // Create a notification for the B2B client
        const message = `Your stock request REQ-${String(id).padStart(5, '0')} has been updated to: ${status}`;
        await db('notifications').insert({
            user_id: requestBeforeUpdate.b2b_user_id,
            message,
            link: '/b2b-portal',
            type: 'B2B_UPDATE',
            entity_id: id
        });
        
        res.json(updatedRequest);
    } catch (error) {
        next(error);
    }
});

// --- General Data Routes (Customers, Branches, Users) ---
// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/customers', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const customers = await db('customers').select('*');
        res.json(customers);
    } catch(error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/customers', authenticate, validate(createCustomerSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const [newCustomer] = await db('customers').insert(req.body).returning('*');
        res.status(201).json(newCustomer);
    } catch(error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/branches', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branches = await db('branches').select('*');
        res.json(branches);
    } catch(error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/users', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const users = await db('users').select('id', 'name', 'email', 'role', 'status');
        res.json(users);
    } catch(error) { next(error); }
});


// --- Invoices Routes ---
// FIX: Add missing endpoints for managing invoices.
app.get('/api/invoices', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { status } = req.query;
        const query = db('invoices as i')
            .join('customers as c', 'i.customer_id', 'c.id')
            .select('i.*', 'c.name as customerName')
            .orderBy('i.created_at', 'desc');

        if (status && status !== 'All') {
            query.where('i.status', status as string);
        }
        
        const invoices = await query;
        res.json(invoices);
    } catch (error) { next(error); }
});

app.get('/api/invoices/snippets/unpaid', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const snippets = await db('invoices')
            .where('status', InvoiceStatus.UNPAID)
            .select('id', 'invoice_no');
        res.json(snippets);
    } catch (error) { next(error); }
});

app.get('/api/invoices/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const invoice = await db('invoices as i')
            .join('customers as c', 'i.customer_id', 'c.id')
            .join('branches as b', 'i.branch_id', 'b.id')
            .where('i.id', id)
            .select('i.*', 'c.name as customerName', 'c.address as customerAddress', 'c.phone as customerPhone', 'b.name as branchName', 'b.address as branchAddress', 'b.phone as branchPhone')
            .first();

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found.' });
        }
        
        const items = await db('invoice_items as ii')
            .join('products as p', 'ii.product_id', 'p.id')
            .where('ii.invoice_id', id)
            .select('ii.*', 'p.name as productName', 'p.part_number as partNumber');
        
        const fullInvoice: Invoice = {
            ...invoice,
            totalAmount: invoice.total_amount,
            amount_paid: invoice.amount_paid,
            customer: {
                id: invoice.customer_id,
                name: invoice.customerName,
                address: invoice.customerAddress,
                phone: invoice.customerPhone,
            },
            branch: {
                id: invoice.branch_id,
                name: invoice.branchName,
                address: invoice.branchAddress,
                phone: invoice.branchPhone
            },
            items: items,
        };
        
        res.json(fullInvoice);
    } catch (error) { next(error); }
});

// --- Sales & POS ---
// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/sales', authenticate, validate(createSaleSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        await db.transaction(async trx => {
            const saleResult = await finalizeSale(req.body, trx);
            res.status(201).json(saleResult);
        });
    } catch (error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/sales', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sales = await db('sales').orderBy('created_at', 'desc');
        res.json(sales);
    } catch(error) { next(error); }
});

// --- Shipping Routes ---
// FIX: Add missing endpoints for managing shipping labels.
app.get('/api/shipping', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const labels = await db('shipping_labels').orderBy('created_at', 'desc');
        res.json(labels);
    } catch(error) { next(error); }
});

app.post('/api/shipping', authenticate, validate(createLabelSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = uuidv4();
        const [newLabel] = await db('shipping_labels').insert({ 
            id, 
            ...req.body, 
            status: ShippingStatus.DRAFT 
        }).returning('*');
        await logAuditEvent(req.user!.id, 'CREATE_SHIPPING_LABEL', { labelId: id, orderId: req.body.sale_id || req.body.invoice_id });
        res.status(201).json(newLabel);
    } catch (error) { next(error); }
});

app.patch('/api/shipping/:id/status', authenticate, validate(updateLabelStatusSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const [updatedLabel] = await db('shipping_labels').where({ id }).update({ status }).returning('*');
        await logAuditEvent(req.user!.id, 'UPDATE_SHIPPING_STATUS', { labelId: id, newStatus: status });
        res.json(updatedLabel);
    } catch (error) { next(error); }
});


// --- M-PESA DARAJA INTEGRATION ---

const getDarajaToken = async (consumerKey: string, consumerSecret: string): Promise<string> => {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const url = process.env.MPESA_ENVIRONMENT === 'live'
        ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    // NOTE: In a high-traffic production app, this token should be cached until it expires.
    const { data } = await axios.get(url, {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    return data.access_token;
};

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/mpesa/stk-push', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { amount, phoneNumber, ...saleDetails } = req.body;
    try {
        const settings = await getAppSettings();
        if (!settings.mpesaConsumerKey || !settings.mpesaConsumerSecret || !settings.mpesaPaybill || !settings.mpesaPasskey) {
            throw new Error("M-Pesa settings are not configured.");
        }

        const token = await getDarajaToken(settings.mpesaConsumerKey, settings.mpesaConsumerSecret);
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${settings.mpesaPaybill}${settings.mpesaPasskey}${timestamp}`).toString('base64');
        const url = process.env.MPESA_ENVIRONMENT === 'live'
            ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
            : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

        const darajaRequest = {
            BusinessShortCode: settings.mpesaPaybill,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount), // Amount must be an integer
            PartyA: phoneNumber,
            PartyB: settings.mpesaPaybill,
            PhoneNumber: phoneNumber,
            CallBackURL: process.env.MPESA_CALLBACK_URL,
            AccountReference: 'MasumaEASale',
            TransactionDesc: 'Payment for autoparts'
        };

        const { data } = await axios.post(url, darajaRequest, { headers: { 'Authorization': `Bearer ${token}` } });

        if (data.ResponseCode !== '0') {
            throw new Error(data.ResponseDescription || 'Failed to initiate STK push.');
        }

        await db('mpesa_transactions').insert({
            checkout_request_id: data.CheckoutRequestID,
            merchant_request_id: data.MerchantRequestID,
            amount,
            phone_number: phoneNumber,
            transaction_details: JSON.stringify(saleDetails)
        });

        res.json({ checkoutRequestId: data.CheckoutRequestID });

    } catch (error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/mpesa/callback', async (req: Request, res: Response) => {
    console.log('--- M-Pesa Callback Received ---');
    console.log(JSON.stringify(req.body, null, 2));

    const callbackData = req.body.Body.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;

    try {
        if (ResultCode === 0) { // Success
            const { Amount, MpesaReceiptNumber } = callbackData.CallbackMetadata.Item.reduce((acc: any, item: any) => {
                acc[item.Name] = item.Value;
                return acc;
            }, {});
            
            const [transaction] = await db('mpesa_transactions').where({ checkout_request_id: CheckoutRequestID }).update({
                status: 'Completed',
                result_desc: ResultDesc,
                mpesa_receipt_number: MpesaReceiptNumber,
            }).returning('*');

            if (transaction && transaction.transaction_details) {
                 await db.transaction(async trx => {
                    const sale = await finalizeSale(transaction.transaction_details as MpesaTransactionPayload, trx);
                    await trx('mpesa_transactions').where({ id: transaction.id }).update({ sale_id: sale.id });
                    console.log(`Sale ${sale.sale_no} created from M-Pesa callback.`);
                 });
            }

        } else { // Failure
            await db('mpesa_transactions').where({ checkout_request_id: CheckoutRequestID }).update({
                status: 'Failed',
                result_desc: ResultDesc,
            });
        }
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error) {
        console.error('Error processing M-Pesa callback:', error);
        // Safaricom expects a success response even if our internal processing fails, to prevent retries.
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/mpesa/status/:checkoutRequestId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { checkoutRequestId } = req.params;
        const transaction = await db('mpesa_transactions').where({ checkout_request_id: checkoutRequestId }).first();
        if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });

        if (transaction.status === 'Completed' && transaction.sale_id) {
            const sale = await db('sales as s')
                .join('customers as c', 's.customer_id', 'c.id')
                .join('branches as b', 's.branch_id', 'b.id')
                .where('s.id', transaction.sale_id).select('s.*', 'c.name as customerName', 'b.name as branchName', 'b.address as branchAddress').first();
            const items = await db('sale_items as si')
                .join('products as p', 'si.product_id', 'p.id')
                .where('si.sale_id', transaction.sale_id).select('si.*', 'p.name as productName');
            return res.json({ status: 'Completed', sale: { ...sale, items } });
        } else if (transaction.status === 'Failed') {
            return res.json({ status: 'Failed', message: transaction.result_desc });
        } else {
            return res.json({ status: 'Pending' });
        }

    } catch (error) { next(error); }
});

// --- Settings ---
const getAppSettings = async (trx?: Knex.Transaction): Promise<Partial<AppSettings>> => {
    const dbInstance = trx || db;
    const settings = await dbInstance('app_settings').select('*');
    return settings.reduce((acc, setting) => {
        acc[setting.setting_key] = setting.setting_value;
        return acc;
    }, {} as any);
};

// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/settings', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        res.json(await getAppSettings());
    } catch (error) { next(error); }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.put('/api/settings', authenticate, validate(updateSettingsSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        await db.transaction(async trx => {
            for (const [key, value] of Object.entries(req.body)) {
                await trx('app_settings').insert({ setting_key: key, setting_value: value }).onConflict('setting_key').merge();
            }
            await logAuditEvent(req.user!.id, 'UPDATE_SETTINGS', { changes: req.body }, trx);
        });
        res.json(req.body);
    } catch(error) { next(error); }
});

// --- Notifications ---
// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/notifications', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const payload: Partial<NotificationPayload> = {};

        // Fetch all unread user-specific alerts for the notification center
        const userNotifications = await db('notifications')
            .where({ user_id: user.id })
            .orderBy('created_at', 'desc')
            .limit(50) // Limit to last 50 notifications for performance
            .select('*');
        
        payload.userAlerts = userNotifications;
        
        res.json(payload);
    } catch (error) {
        next(error);
    }
});

// FIX: Use explicit express types to resolve global type conflicts.
app.post('/api/notifications/mark-read', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Notification IDs must be a non-empty array.' });
        }
        await db('notifications')
            .where('user_id', req.user!.id)
            .whereIn('id', ids)
            .update({ is_read: true });
        
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});


// --- Audit Logs ---
// FIX: Use explicit express types to resolve global type conflicts.
app.get('/api/audit-logs', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 15;
        const offset = (page - 1) * limit;

        const logsQuery = db('audit_logs as al')
            .join('users as u', 'al.user_id', 'u.id')
            .select('al.*', 'u.name as userName')
            .orderBy('al.created_at', 'desc')
            .limit(limit)
            .offset(offset);
            
        const totalQuery = db('audit_logs').count({ total: '*' }).first();
        
        const [logs, totalResult] = await Promise.all([logsQuery, totalQuery]);
        
        res.json({ logs, total: (totalResult as any).total });
    } catch (error) {
        next(error);
    }
});


// --- GLOBAL ERROR HANDLER ---
// FIX: Use explicit express types to resolve global type conflicts.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({ status: 'error', statusCode, message });
});


// --- SERVER INITIALIZATION ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});