
// FIX: Replaced qualified express type imports (e.g., express.Request) with direct imports
// from 'express' (e.g., Request) and explicitly typed all route handlers. This resolves
// numerous type inference errors that were causing compilation failures.
// DEVELOPER NOTE: The above fix comment was incorrect. The reverse action (using qualified imports) was necessary to fix type collisions.
// FIX: Changed import style to use a default import for Express and qualified types to resolve widespread type conflicts.
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenAI, Type } from "@google/genai";
import db from './db';
import { UserRole, SalePayload } from '@masuma-ea/types';
import type { Knex } from 'knex';
import axios from 'axios';
import {
    validate,
    loginSchema,
    googleLoginSchema,
    registerSchema,
    productSchema,
    updateProductSchema,
    bulkProductSchema,
    updateB2BStatusSchema,
    createUserSchema,
    updateUserSchema,
    updatePasswordSchema,
    createSaleSchema,
    createLabelSchema,
    updateLabelStatusSchema,
    createQuotationSchema,
    updateQuotationStatusSchema,
    createBranchSchema,
    updateBranchSchema,
    createCustomerSchema,
    updateSettingsSchema
} from './validation';


// --- CONFIGURATION ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const googleAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));


// --- FILE UPLOAD CONFIG ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the uploads directory exists
    const fs = require('fs');
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });


// --- STATIC ASSETS ---
// Serve uploaded documents (e.g., B2B registration files) from the /uploads route.
// This makes files accessible via URLs like 'https://erp.masuma.africa/uploads/filename.pdf'
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- PRODUCTION FRONTEND SERVING ---
// For the single-subdomain deployment on 'erp.masuma.africa', this Express server
// is responsible for serving the compiled frontend application. The following
// middleware points to the 'dist' directory created by the frontend's build process.
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));


// --- API ROUTER ---
// All API endpoints are prefixed with /api to distinguish them from frontend routes.
const apiRouter = express.Router();

// A dummy auth middleware
// FIX: Explicitly typed parameters with `express.*` types to ensure type consistency.
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // In a real app, this would validate a JWT from the Authorization header
    // This is a placeholder for now.
    next();
};

// --- AUTH ---
apiRouter.post('/auth/login', validate(loginSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { email, password } = req.body;
    try {
        const user = await db('users').where({ email }).first();

        if (!user || !user.password_hash) {
            return res.status(401).json({ message: 'Invalid credentials or user setup issue.' });
        }
        
        if (user.status !== 'Active') {
            return res.status(403).json({ message: 'User account is inactive.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const payload = {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };

        const token = jwt.sign(
            payload, 
            process.env.JWT_SECRET || 'a-very-secret-and-secure-key-for-dev', // Use a default for safety in dev
            { expiresIn: '7d' }
        );

        res.json({ token });

    } catch (error) {
        next(error);
    }
});
apiRouter.post('/auth/google-login', validate(googleLoginSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { token: googleToken } = req.body;
    try {
        const ticket = await googleAuthClient.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const googlePayload = ticket.getPayload();
        if (!googlePayload || !googlePayload.email) {
            return res.status(400).json({ message: "Invalid Google token." });
        }

        const user = await db('users').where({ email: googlePayload.email }).first();

        if (!user) {
            return res.status(401).json({ message: "User not registered. Please sign up or contact an administrator." });
        }
        
        if (user.status !== 'Active') {
            return res.status(403).json({ message: 'User account is inactive.' });
        }

        const payload = {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };

        const token = jwt.sign(
            payload, 
            process.env.JWT_SECRET || 'a-very-secret-and-secure-key-for-dev',
            { expiresIn: '7d' }
        );

        res.json({ token });
    } catch (error) {
        console.error("Google login error:", error);
        next(new Error("Google sign-in failed."));
    }
});
apiRouter.post('/auth/register', upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), validate(registerSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files.certOfInc || !files.cr12) {
            return res.status(400).json({ message: 'Both Certificate of Incorporation and CR12 are required.' });
        }

        const certOfIncUrl = `/uploads/${files.certOfInc[0].filename}`;
        const cr12Url = `/uploads/${files.cr12[0].filename}`;
        
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newApplication = {
            id: uuidv4(),
            business_name: businessName,
            kra_pin: kraPin,
            contact_name: contactName,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            password_hash,
            cert_of_inc_url: certOfIncUrl,
            cr12_url: cr12Url,
            status: 'Pending',
        };
        
        await db('b2b_applications').insert(newApplication);
        
        const responsePayload = { ...newApplication, businessName: newApplication.business_name };
        res.status(201).json(responsePayload);
    } catch (error) {
        next(error);
    }
});

// --- NOTIFICATIONS ---
apiRouter.get('/notifications', authenticate, async (req: express.Request, res: express.Response) => {
    const lowStockThresholdSetting = await db('app_settings').where('setting_key', 'lowStockThreshold').first();
    const lowStockThreshold = Number(lowStockThresholdSetting?.setting_value) || 10;
    const [newApplications, lowStockProducts] = await Promise.all([
        db('b2b_applications').where({ status: 'Pending' }).select('id', 'business_name as businessName'),
        db('products').where('stock', '<=', lowStockThreshold).select('id', 'name', 'stock'),
    ]);
    res.json({ newApplications, lowStockProducts, serverTimestamp: new Date().toISOString() });
});

// --- INVENTORY ---
// FIX: Aliased snake_case columns to camelCase to match frontend type definitions.
apiRouter.get('/inventory/products', authenticate, async (req: express.Request, res: express.Response) => {
    const products = await db('products').select(
        'id',
        'part_number as partNumber',
        'name',
        'retail_price as retailPrice',
        'wholesale_price as wholesalePrice',
        'stock'
    );
    res.json(products);
});
apiRouter.post('/inventory/products', authenticate, validate(productSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { partNumber, name, retailPrice, wholesalePrice, stock } = req.body;
        const newProduct = {
            id: uuidv4(),
            part_number: partNumber,
            name,
            retail_price: retailPrice,
            wholesale_price: wholesalePrice,
            stock,
        };
        await db('products').insert(newProduct);
        res.status(201).json({ ...newProduct, partNumber, retailPrice, wholesalePrice });
    } catch (error) {
        next(error);
    }
});
apiRouter.patch('/inventory/products/:id', authenticate, validate(updateProductSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const { partNumber, name, retailPrice, wholesalePrice, stock } = req.body;
        const updatedCount = await db('products').where({ id }).update({
            part_number: partNumber,
            name,
            retail_price: retailPrice,
            wholesale_price: wholesalePrice,
            stock,
        });

        if (updatedCount === 0) return res.status(404).json({ message: 'Product not found' });
        
        const updatedProduct = await db('products').where({ id }).first();
        res.json({ ...updatedProduct, partNumber, retailPrice, wholesalePrice });
    } catch (error) {
        next(error);
    }
});

apiRouter.post('/inventory/products/bulk', authenticate, validate(bulkProductSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const products = req.body.map((p: any) => ({
            id: uuidv4(),
            part_number: p.partNumber,
            name: p.name,
            retail_price: p.retailPrice,
            wholesale_price: p.wholesalePrice,
            stock: p.stock
        }));
        // FIX: Replaced db.batchInsert with db('products').insert to allow for .onConflict().merge() which is not available on batchInsert for mysql.
        await db('products').insert(products).onConflict('part_number').merge();
        res.json({ message: 'Products imported successfully' });
    } catch (error) {
        next(error);
    }
});

apiRouter.get('/inventory/fast-moving', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { startDate, endDate, branchId } = req.query;
    try {
        // FIX: Replaced string-based date manipulation with Date objects for robust, timezone-proof queries.
        const start = new Date(startDate as string);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(endDate as string);
        end.setUTCHours(23, 59, 59, 999);

        let query = db('sale_items')
            .join('sales', 'sale_items.sale_id', 'sales.id')
            .join('products', 'sale_items.product_id', 'products.id')
            .select(
                'products.id',
                'products.part_number as partNumber',
                'products.name',
                'products.stock as currentStock'
            )
            .sum('sale_items.quantity as totalSold')
            .whereBetween('sales.created_at', [start, end])
            .groupBy('products.id', 'products.part_number', 'products.name', 'products.stock')
            .orderBy('totalSold', 'desc')
            .limit(10);
        
        if (branchId) {
            query = query.andWhere('sales.branch_id', branchId as any);
        }

        const results = await query;
        
        // Knex SUM returns a string for mysql2, so we cast it to a number.
        const formattedResults = results.map(r => ({ ...r, totalSold: Number(r.totalSold) }));
        res.json(formattedResults);
    } catch (error) {
        next(error);
    }
});


// --- B2B ---
// FIX: Aliased snake_case columns to camelCase to match frontend type definitions.
apiRouter.get('/b2b/applications', authenticate, async (req: express.Request, res: express.Response) => {
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
});
apiRouter.patch('/b2b/applications/:id/status', authenticate, validate(updateB2BStatusSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const application = await db('b2b_applications').where({ id }).first();
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        if (status === 'Approved' && application.status !== 'Approved') {
            await db.transaction(async trx => {
                // Create a corresponding user
                const newUser = {
                    id: uuidv4(),
                    name: application.contact_name,
                    email: application.contact_email,
                    password_hash: application.password_hash, // Already hashed during registration
                    role: UserRole.B2B_CLIENT,
                    b2b_application_id: id,
                    status: 'Active',
                };
                await trx('users').insert(newUser);
                await trx('b2b_applications').where({ id }).update({ status });
            });
        } else {
            await db('b2b_applications').where({ id }).update({ status });
        }

        const updatedApplication = await db('b2b_applications').where({ id }).first();
        const responsePayload = { ...updatedApplication, businessName: updatedApplication.business_name };
        res.json(responsePayload);

    } catch (error) {
        next(error);
    }
});

// --- USERS ---
apiRouter.get('/users', authenticate, async (req: express.Request, res: express.Response) => res.json(await db('users').select('id', 'name', 'email', 'role', 'status')));
apiRouter.post('/users', authenticate, validate(createUserSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { name, email, password, role, status } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUser = {
            id: uuidv4(),
            name,
            email,
            password_hash,
            role,
            status: status || 'Active',
        };
        await db('users').insert(newUser);
        res.status(201).json({ id: newUser.id, name, email, role, status: newUser.status });
    } catch (error) {
        next(error);
    }
});
apiRouter.patch('/users/:id', authenticate, validate(updateUserSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { id } = req.params;
    try {
        // FIX: Corrected array destructuring for Knex update, which returns a number for mysql.
        const updatedCount = await db('users').where({ id }).update(req.body);
        if (updatedCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const updatedUser = await db('users').where({ id }).select('id', 'name', 'email', 'role', 'status').first();
        res.json(updatedUser);
    } catch (error) {
        next(error);
    }
});
apiRouter.patch('/users/me/password', authenticate, validate(updatePasswordSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // This assumes a userId is available from a real auth middleware
    const userId = '93288475-93a8-4e45-ae9c-e19d6ecb26ca'; // Hardcoded for demo
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await db('users').where({ id: userId }).first();
        if (!user) return res.status(404).json({ message: "User not found." });

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) return res.status(400).json({ message: "Incorrect current password." });

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);
        await db('users').where({ id: userId }).update({ password_hash: newPasswordHash });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        next(error);
    }
});


// --- POS ---
/**
 * A reusable function to create a sale within a database transaction.
 * This is used by both the direct POS endpoint and the M-Pesa callback.
 */
const createSaleInDb = async (trx: Knex.Transaction, payload: SalePayload) => {
    const { customerId, branchId, items, taxAmount, totalAmount, paymentMethod, invoiceId } = payload;

    const sale_no = `SALE-${Date.now()}`;
    const [saleId] = await trx('sales').insert({
        sale_no,
        customer_id: customerId,
        branch_id: branchId,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        invoice_id: invoiceId,
    });

    const saleItems = items.map((item: any) => ({
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice
    }));
    await trx('sale_items').insert(saleItems);

    for (const item of items) {
        await trx('products')
            .where('id', item.productId)
            .decrement('stock', item.quantity);
    }

    if (invoiceId) {
        await trx('invoices').where('id', invoiceId).update({ status: 'Paid', amount_paid: totalAmount });
    }
    
    // Fetch the complete sale object for the receipt
    const finalSale = await trx('sales').where({ id: saleId }).first();
    const finalItems = await trx('sale_items')
        .join('products', 'sale_items.product_id', 'products.id')
        .where({ sale_id: saleId })
        .select('sale_items.*', 'products.name as product_name', 'products.part_number');
    const customer = await trx('customers').where({ id: customerId }).first();
    const branch = await trx('branches').where({ id: branchId }).first();

    // FIX: Construct the final object to ensure correct types, converting decimals from strings to numbers.
    return { 
        id: finalSale.id,
        sale_no: finalSale.sale_no,
        customer_id: finalSale.customer_id,
        branch_id: finalSale.branch_id,
        created_at: finalSale.created_at,
        payment_method: finalSale.payment_method,
        invoice_id: finalSale.invoice_id,
        items: finalItems,
        customer, 
        branch, 
        tax_amount: Number(finalSale.tax_amount), 
        amount: Number(finalSale.total_amount),
    };
};

apiRouter.post('/pos/sales', authenticate, validate(createSaleSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const newSale = await db.transaction(async trx => {
            return await createSaleInDb(trx, req.body);
        });
        res.status(201).json(newSale);
    } catch(error) {
        next(error);
    }
});


// --- SHIPPING ---
apiRouter.get('/shipping/labels', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { startDate, endDate } = req.query;
    try {
        let query = db('shipping_labels').select('*').orderBy('created_at', 'desc');
        if (startDate && endDate) {
            // FIX: Replaced string-based date manipulation with Date objects for robust, timezone-proof queries.
            const start = new Date(startDate as string);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate as string);
            end.setUTCHours(23, 59, 59, 999);
            query = query.whereBetween('created_at', [start, end]);
        }
        const labels = await query;
        res.json(labels);
    } catch (error) {
        next(error);
    }
});
apiRouter.post('/shipping/labels', authenticate, validate(createLabelSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const newLabel = { id: uuidv4(), status: 'Draft', ...req.body };
        await db('shipping_labels').insert(newLabel);
        res.status(201).json({ ...newLabel, created_at: new Date().toISOString() });
    } catch (error) {
        next(error);
    }
});
apiRouter.patch('/shipping/labels/:id/status', authenticate, validate(updateLabelStatusSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db('shipping_labels').where({ id }).update({ status });
        const updatedLabel = await db('shipping_labels').where({ id }).first();
        res.json(updatedLabel);
    } catch (error) {
        next(error);
    }
});


// --- QUOTATIONS & INVOICES ---
apiRouter.get('/quotations', authenticate, async (req: express.Request, res: express.Response) => {
    const data = await db('quotations')
        .join('customers', 'quotations.customer_id', 'customers.id')
        .select('quotations.*', 'customers.name as customerName')
        .orderBy('created_at', 'desc');
    res.json(data);
});
apiRouter.get('/quotations/:id', authenticate, async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const quotation = await db('quotations').where({ id }).first();
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    
    const itemsData = await db('quotation_items')
        .join('products', 'quotation_items.product_id', 'products.id')
        .where({ quotation_id: id })
        .select('quotation_items.*', 'products.name as product_name', 'products.part_number');

    // FIX: Convert decimal strings from the database to numbers to prevent frontend type errors.
    const items = itemsData.map((item: any) => ({
        ...item,
        unit_price: Number(item.unit_price),
    }));

    const customer = await db('customers').where({ id: quotation.customer_id }).first();
    const branch = await db('branches').where({ id: quotation.branch_id }).first();
    
    // FIX: Ensure the total amount on the quotation object is a number.
    const finalQuotation = {
        ...quotation,
        total_amount: Number(quotation.total_amount),
    };
    
    res.json({ ...finalQuotation, items, customer, branch });
});
apiRouter.post('/quotations', authenticate, validate(createQuotationSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { customerId, branchId, items, validUntil } = req.body;
    try {
        const newQuotation = await db.transaction(async trx => {
            const quotation_no = `QUO-${Date.now()}`;
            const totalAmount = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);

            const [quotationId] = await trx('quotations').insert({
                quotation_no,
                customer_id: customerId,
                branch_id: branchId,
                valid_until: validUntil,
                total_amount: totalAmount,
                status: 'Draft',
            });

            const quotationItems = items.map((item: any) => ({
                quotation_id: quotationId,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice
            }));
            await trx('quotation_items').insert(quotationItems);
            
            const finalQuotation = await trx('quotations').where({ id: quotationId }).first();
            const customer = await trx('customers').where({ id: customerId }).first();
            return { ...finalQuotation, customerName: customer.name, amount: finalQuotation.total_amount };
        });
        res.status(201).json(newQuotation);
    } catch(error) {
        next(error);
    }
});
apiRouter.patch('/quotations/:id/status', authenticate, validate(updateQuotationStatusSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db('quotations').where({ id }).update({ status });
        const updated = await db('quotations').where({ id }).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

apiRouter.post('/quotations/:id/convert', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { id } = req.params;
    try {
        const newInvoice = await db.transaction(async trx => {
            const quotation = await trx('quotations').where({ id }).first();
            if (!quotation) throw new Error('Quotation not found');

            const items = await trx('quotation_items').where({ quotation_id: id });
            const settings = await trx('app_settings').where('setting_key', 'invoiceDueDays').first();
            const dueDays = settings ? parseInt(settings.setting_value, 10) : 30;

            const invoice_no = `INV-${Date.now()}`;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + dueDays);

            const [invoiceId] = await trx('invoices').insert({
                invoice_no,
                customer_id: quotation.customer_id,
                branch_id: quotation.branch_id,
                quotation_id: id,
                due_date: dueDate.toISOString().split('T')[0],
                total_amount: quotation.total_amount,
                status: 'Unpaid',
            });

            const invoiceItems = items.map(item => ({
                invoice_id: invoiceId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
            }));
            await trx('invoice_items').insert(invoiceItems);
            await trx('quotations').where({ id }).update({ status: 'Invoiced' });
            
            // Fetch the full invoice details to return to the frontend
            const finalInvoice = await trx('invoices').where({ 'invoices.id': invoiceId })
                .join('customers', 'invoices.customer_id', 'customers.id')
                .select('invoices.*', 'customers.name as customerName')
                .first();
                
            return { ...finalInvoice, amount: finalInvoice.total_amount };
        });
        res.status(201).json(newInvoice);
    } catch (error) {
        next(error);
    }
});


apiRouter.get('/invoices', authenticate, async (req: express.Request, res: express.Response) => {
    const { status } = req.query;
    let query = db('invoices')
        .join('customers', 'invoices.customer_id', 'customers.id')
        .select('invoices.*', 'customers.name as customerName')
        .orderBy('created_at', 'desc');

    if (status && typeof status === 'string' && status !== 'All') {
        query = query.where('invoices.status', status);
    }
    const data = await query;
    res.json(data);
});
apiRouter.get('/invoices/:id', authenticate, async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const invoice = await db('invoices').where({ id }).first();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    const itemsData = await db('invoice_items')
        .join('products', 'invoice_items.product_id', 'products.id')
        .where({ invoice_id: id })
        .select('invoice_items.*', 'products.name as product_name', 'products.part_number');

    // FIX: Convert decimal strings from the database to numbers to prevent frontend type errors.
    const items = itemsData.map((item: any) => ({
        ...item,
        unit_price: Number(item.unit_price),
    }));

    const customer = await db('customers').where({ id: invoice.customer_id }).first();
    const branch = await db('branches').where({ id: invoice.branch_id }).first();
    
    // FIX: Ensure all monetary values on the main invoice object are numbers.
    const finalInvoice = {
        ...invoice,
        total_amount: Number(invoice.total_amount),
        amount_paid: Number(invoice.amount_paid),
    };

    res.json({ ...finalInvoice, items, customer, branch });
});

// --- GENERAL DATA ---
apiRouter.get('/data/sales', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { startDate, endDate } = req.query;
    try {
        let query = db('sales').select('*').orderBy('created_at', 'desc');
        if (startDate && endDate) {
            // FIX: Replaced string-based date manipulation with Date objects for robust, timezone-proof queries.
            const start = new Date(startDate as string);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate as string);
            end.setUTCHours(23, 59, 59, 999);
            query = query.whereBetween('created_at', [start, end]);
        }
        const sales = await query;
        // FIX: Map over sales to convert decimal strings to numbers and alias total_amount to amount.
        const formattedSales = sales.map(s => ({
            ...s,
            tax_amount: Number(s.tax_amount),
            amount: Number(s.total_amount)
        }));
        res.json(formattedSales);
    } catch (error) {
        next(error);
    }
});
apiRouter.get('/data/invoices', authenticate, async (req: express.Request, res: express.Response) => {
    // This endpoint is for the POS dropdown, needs only unpaid invoice snippets
    const unpaidInvoices = await db('invoices')
        .where('status', 'Unpaid')
        .select('id', 'invoice_no');
    res.json(unpaidInvoices);
});
apiRouter.get('/data/branches', authenticate, async (req: express.Request, res: express.Response) => res.json(await db('branches').select('*')));
apiRouter.post('/data/branches', authenticate, validate(createBranchSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { name, address, phone } = req.body;
        const [newId] = await db('branches').insert({
            name,
            address,
            phone,
        });
        const newBranch = await db('branches').where({ id: newId }).first();
        res.status(201).json(newBranch);
    } catch (error) {
        next(error);
    }
});
apiRouter.patch('/data/branches/:id', authenticate, validate(updateBranchSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { id } = req.params;
    try {
        const updatedCount = await db('branches').where({ id }).update(req.body);
        if (updatedCount === 0) {
            return res.status(404).json({ message: 'Branch not found' });
        }
        const updatedBranch = await db('branches').where({ id }).first();
        res.json(updatedBranch);
    } catch (error) {
        next(error);
    }
});
// FIX: Aliased snake_case columns to camelCase to match frontend type definitions.
apiRouter.get('/data/customers', authenticate, async (req: express.Request, res: express.Response) => {
    const customers = await db('customers').select(
        'id',
        'name',
        'address',
        'phone',
        'kra_pin as kraPin'
    );
    res.json(customers);
});
apiRouter.get('/customers/:id/transactions', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { id } = req.params;
    try {
        const [salesResults, invoicesResults, quotationsResults] = await Promise.all([
            db('sales').where({ customer_id: id }).select('id', 'sale_no', 'created_at', 'total_amount as amount').orderBy('created_at', 'desc'),
            db('invoices')
                .where({ customer_id: id })
                .join('customers', 'invoices.customer_id', 'customers.id')
                .select('invoices.id', 'invoices.invoice_no', 'invoices.created_at', 'invoices.total_amount as amount', 'invoices.status')
                .orderBy('created_at', 'desc'),
            db('quotations')
                .where({ customer_id: id })
                .join('customers', 'quotations.customer_id', 'customers.id')
                .select('quotations.id', 'quotations.quotation_no', 'quotations.created_at', 'quotations.total_amount as amount', 'quotations.status')
                .orderBy('created_at', 'desc')
        ]);
        // FIX: Ensure all amount fields returned to the frontend are numbers.
        const sales = salesResults.map(s => ({ ...s, amount: Number(s.amount) }));
        const invoices = invoicesResults.map(i => ({ ...i, amount: Number(i.amount) }));
        const quotations = quotationsResults.map(q => ({ ...q, amount: Number(q.amount) }));

        res.json({ sales, invoices, quotations });
    } catch (error) {
        next(error);
    }
});
apiRouter.post('/data/customers', authenticate, validate(createCustomerSchema), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { name, address, phone, kraPin } = req.body;
        const [newId] = await db('customers').insert({
            name,
            address,
            phone,
            kra_pin: kraPin,
        });
        
        const newCustomer = await db('customers').where({ id: newId }).select(
            'id',
            'name',
            'address',
            'phone',
            'kra_pin as kraPin'
        ).first();

        res.status(201).json(newCustomer);
    } catch (error) {
        next(error);
    }
});

// --- SETTINGS ---
// FIX: Implemented GET /settings to read from the database instead of returning a hardcoded object.
apiRouter.get('/settings', authenticate, async (req: express.Request, res: express.Response) => {
    const settingsRows = await db('app_settings').select('*');
    const settings = settingsRows.reduce((acc, row) => {
        // Attempt to parse numbers, otherwise keep as string
        const isNumeric = !isNaN(parseFloat(row.setting_value)) && isFinite(row.setting_value);
        acc[row.setting_key] = isNumeric ? Number(row.setting_value) : row.setting_value;
        return acc;
    }, {} as Record<string, any>);
    
    // Provide defaults for any missing settings to ensure frontend stability
    const defaults = {
        companyName: 'Masuma EA Hub',
        companyAddress: '',
        companyPhone: '',
        companyKraPin: '',
        taxRate: 16,
        invoiceDueDays: 30,
        lowStockThreshold: 10,
        mpesaPaybill: '',
        mpesaConsumerKey: '',
        mpesaConsumerSecret: '',
        mpesaPasskey: '',
    };

    res.json({ ...defaults, ...settings });
});
// FIX: Implemented PATCH /settings to save changes to the database.
apiRouter.patch('/settings', authenticate, validate(updateSettingsSchema), async (req: express.Request, res: express.Response) => {
    const settingsData = req.body;
    
    await db.transaction(async (trx) => {
        const promises = Object.entries(settingsData).map(([key, value]) => {
            return trx('app_settings')
                .where({ setting_key: key })
                .update({ setting_value: String(value) })
                .then(updatedCount => {
                    if (updatedCount === 0) {
                        // If the key doesn't exist, insert it
                        return trx('app_settings').insert({ setting_key: key, setting_value: String(value) });
                    }
                });
        });
        await Promise.all(promises);
    });

    res.json(settingsData);
});

// --- DASHBOARD & REPORTS ---
apiRouter.get('/dashboard/stats', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { startDate, endDate, branchId } = req.query;
    try {
        // FIX: Replaced string-based date manipulation with Date objects for robust, timezone-proof queries.
        const start = new Date(startDate as string);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(endDate as string);
        end.setUTCHours(23, 59, 59, 999);

        let salesQuery = db('sales').whereBetween('created_at', [start, end]);
        let shipmentsQuery = db('shipping_labels').whereBetween('created_at', [start, end]);
        
        if (branchId) {
            salesQuery = salesQuery.andWhere('branch_id', branchId as any);
            shipmentsQuery = shipmentsQuery.andWhere('from_branch_id', branchId as any);
        }

        // FIX: Explicitly cast the knex query results to avoid 'never' type inference issues.
        // FIX: Removed invalid `as Promise<...>` cast on Knex query builders.
        const [salesResults, totalShipments, pendingShipments, salesTargetResult] = await Promise.all([
            salesQuery.select(db.raw('SUM(total_amount) as totalRevenue'), db.raw('COUNT(id) as totalSales'), db.raw('COUNT(DISTINCT customer_id) as activeCustomers')).first(),
            shipmentsQuery.clone().count({ count: '*' }).first(),
            shipmentsQuery.clone().whereNot('status', 'Shipped').count({ count: '*' }).first(),
            db('app_settings').where('setting_key', 'salesTarget').first()
        ]);

        res.json({
// FIX: Added optional chaining to prevent crash if queries return no results.
// FIX: Cast query results to 'any' to resolve TypeScript 'never' type inference issue.
            totalRevenue: Number((salesResults as any)?.totalRevenue) || 0,
            totalSales: Number((salesResults as any)?.totalSales) || 0,
            activeCustomers: Number((salesResults as any)?.activeCustomers) || 0,
            totalShipments: Number((totalShipments as any)?.count) || 0,
            pendingShipments: Number((pendingShipments as any)?.count) || 0,
            salesTarget: Number((salesTargetResult as any)?.setting_value) || 2000000
        });
    } catch (error) {
        next(error);
    }
});

apiRouter.get('/dashboard/sales-chart', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { startDate, endDate, branchId } = req.query;
    try {
        // FIX: Replaced string-based date manipulation with Date objects for robust, timezone-proof queries.
        const start = new Date(startDate as string);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(endDate as string);
        end.setUTCHours(23, 59, 59, 999);

        let query = db('sales')
            .select(db.raw('DATE(created_at) as name'), db.raw('SUM(total_amount) as revenue'), db.raw('COUNT(id) as sales'))
            .whereBetween('created_at', [start, end])
            .groupByRaw('DATE(created_at)')
            .orderByRaw('DATE(created_at)');
        
        if (branchId) {
            query = query.andWhere('branch_id', branchId as any);
        }
        
        const data = await query;
        res.json(data);
    } catch(error) {
        next(error);
    }
});

apiRouter.post('/dashboard/sales-target', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { target } = req.body;
        await db('app_settings').insert({ setting_key: 'salesTarget', setting_value: target }).onConflict('setting_key').merge();
        res.json({ salesTarget: target });
    } catch (error) {
        next(error);
    }
});


// --- VIN PICKER ---
apiRouter.get('/vin-picker/:vin', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const { vin } = req.params;
        if (!vin || vin.length < 17) {
            return res.status(400).json({ message: 'A valid 17-character VIN is required.' });
        }
        const prompt = `Given the VIN ${vin}, list compatible Masuma auto parts. Provide the part number, part name, a brief compatibility description (e.g., "Fits Toyota Corolla 2018-2022 models"), and a fake stock level integer between 0 and 100.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "A unique identifier for the part, can be the part number." },
                            partNumber: { type: Type.STRING },
                            name: { type: Type.STRING },
                            stock: { type: Type.INTEGER },
                            compatibility: { type: Type.STRING }
                        },
                        required: ["id", "partNumber", "name", "stock", "compatibility"]
                    }
                }
            }
        });
        
        const text = response.text;
        if (text === undefined) {
            throw new Error("The AI model returned an empty response, which may be due to content filters.");
        }
        
        const jsonText = text.trim();
        const parts = JSON.parse(jsonText);
        res.json(parts);

    } catch (error) {
        console.error("Gemini API error in VIN picker:", error);
        res.status(500).json({ message: "Could not retrieve parts using VIN." });
    }
});

// --- PAYMENTS (M-PESA) ---
// In-memory cache for Daraja API token
let darajaToken: { token: string; expires: number } | null = null;
const DARAJA_API_URL = 'https://api.safaricom.co.ke'; // Use sandbox for dev: 'https://sandbox.safaricom.co.ke'

const getDarajaToken = async (consumerKey: string, consumerSecret: string) => {
    if (darajaToken && darajaToken.expires > Date.now()) {
        return darajaToken.token;
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    try {
        const response = await axios.get(`${DARAJA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const { access_token, expires_in } = response.data;
        darajaToken = {
            token: access_token,
            expires: Date.now() + (parseInt(expires_in, 10) - 300) * 1000, // Refresh 5 mins early
        };
        return darajaToken.token;
    } catch (error: any) {
        console.error('Failed to get Daraja token:', error.response?.data || error.message);
        throw new Error('Could not authenticate with M-Pesa. Check credentials.');
    }
};

apiRouter.post('/payments/mpesa/initiate', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { amount, phoneNumber, ...salePayload } = req.body;
    try {
        const settings = await db('app_settings').select();
        const mpesaSettings = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {} as any);

        const requiredKeys = ['mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaPasskey', 'mpesaPaybill'];
        if (requiredKeys.some(key => !mpesaSettings[key])) {
            return res.status(500).json({ message: 'M-Pesa settings are not fully configured.' });
        }

        const token = await getDarajaToken(mpesaSettings.mpesaConsumerKey, mpesaSettings.mpesaConsumerSecret);

        const now = new Date();
        const timestamp = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2) + ('0' + now.getHours()).slice(-2) + ('0' + now.getMinutes()).slice(-2) + ('0' + now.getSeconds()).slice(-2);
        const password = Buffer.from(mpesaSettings.mpesaPaybill + mpesaSettings.mpesaPasskey + timestamp).toString('base64');
        const callbackUrl = `${req.protocol}://${req.get('host')}/api/payments/mpesa/callback`;

        const stkPayload = {
            BusinessShortCode: mpesaSettings.mpesaPaybill,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount), // M-Pesa requires an integer
            PartyA: phoneNumber,
            PartyB: mpesaSettings.mpesaPaybill,
            PhoneNumber: phoneNumber,
            CallBackURL: callbackUrl,
            AccountReference: salePayload.invoiceId ? `INV${salePayload.invoiceId}` : 'MASUMA-SALE',
            TransactionDesc: 'Payment for autoparts'
        };

        const darajaResponse = await axios.post(`${DARAJA_API_URL}/mpesa/stkpush/v1/processrequest`, stkPayload, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const { MerchantRequestID, CheckoutRequestID } = darajaResponse.data;
        
        // Save pending transaction
        await db('mpesa_transactions').insert({
            checkout_request_id: CheckoutRequestID,
            merchant_request_id: MerchantRequestID,
            amount: amount,
            phone_number: phoneNumber,
            invoice_id: salePayload.invoiceId || null,
            transaction_details: JSON.stringify(salePayload),
            status: 'Pending',
        });

        res.json({ checkoutRequestId: CheckoutRequestID });

    } catch (error: any) {
        console.error('M-Pesa initiation failed:', error.response?.data || error.message);
        next(new Error('Failed to initiate M-Pesa payment.'));
    }
});

apiRouter.post('/payments/mpesa/callback', async (req: express.Request, res: express.Response) => {
    console.log('--- M-Pesa Callback Received ---');
    console.log(JSON.stringify(req.body, null, 2));

    const callbackData = req.body.Body.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;

    try {
        if (ResultCode === 0) {
            // Success
            const metadata = callbackData.CallbackMetadata.Item;
            const mpesaReceipt = metadata.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
            
            const pendingTx = await db('mpesa_transactions').where({ checkout_request_id: CheckoutRequestID }).first();
            if (!pendingTx || pendingTx.status !== 'Pending') {
                 console.log(`Callback for already processed or unknown transaction ${CheckoutRequestID}`);
                 return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
            }

            const salePayload: SalePayload = pendingTx.transaction_details;

            const newSale = await db.transaction(async trx => {
                const sale = await createSaleInDb(trx, salePayload);
                await trx('mpesa_transactions').where({ id: pendingTx.id }).update({
                    status: 'Completed',
                    sale_id: sale.id,
                    result_desc: ResultDesc,
                    mpesa_receipt_number: mpesaReceipt,
                    transaction_details: JSON.stringify(callbackData),
                });
                return sale;
            });
            console.log(`Successfully created sale ${newSale.sale_no} for M-Pesa tx ${CheckoutRequestID}`);

        } else {
            // Failure
            await db('mpesa_transactions').where({ checkout_request_id: CheckoutRequestID }).update({
                status: 'Failed',
                result_desc: ResultDesc,
                transaction_details: JSON.stringify(callbackData),
            });
            console.log(`M-Pesa tx ${CheckoutRequestID} failed: ${ResultDesc}`);
        }

        res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    } catch (error) {
        console.error('Error processing M-Pesa callback:', error);
        // Don't send a failure response to Safaricom, as they might retry.
        // Log the error for internal debugging.
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
});


apiRouter.get('/payments/mpesa/status/:checkoutRequestId', authenticate, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { checkoutRequestId } = req.params;
    try {
        const tx = await db('mpesa_transactions').where({ checkout_request_id: checkoutRequestId }).first();
        if (!tx) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (tx.status === 'Completed' && tx.sale_id) {
            const sale = await db('sales').where({ id: tx.sale_id }).first();
            const items = await db('sale_items').join('products', 'sale_items.product_id', 'products.id').where({ sale_id: tx.sale_id }).select('sale_items.*', 'products.name as product_name');
            const customer = await db('customers').where({ id: sale.customer_id }).first();
            const branch = await db('branches').where({ id: sale.branch_id }).first();
             // FIX: Reconstruct sale object to ensure correct types for the frontend.
            const fullSale = {
                id: sale.id,
                sale_no: sale.sale_no,
                customer_id: sale.customer_id,
                branch_id: sale.branch_id,
                created_at: sale.created_at,
                payment_method: sale.payment_method,
                invoice_id: sale.invoice_id,
                items,
                customer,
                branch,
                tax_amount: Number(sale.tax_amount),
                amount: Number(sale.total_amount)
            };
            res.json({ status: tx.status, sale: fullSale });
        } else {
            res.json({ status: tx.status, message: tx.result_desc });
        }
    } catch (error) {
        next(error);
    }
});

app.use('/api', apiRouter);


// --- REACT APP HANDLER (SPA Fallback) ---
// This is a catch-all route that must be placed AFTER all other API routes and static file handlers.
// It serves the main 'index.html' file of the React app for any request that doesn't match an API endpoint
// or a static asset (like a JS or CSS file). This allows React Router to take over and handle client-side routing.
// For example, a request to 'https://erp.masuma.africa/dashboard' will be handled here.
app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});


// --- GLOBAL ERROR HANDLER ---
// FIX: Added explicit types for req, res, next to satisfy Express's error handler signature.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err); // Log the full error, including stack for debugging
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Something went wrong on the server!';
    res.status(statusCode).json({ message });
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});

export default app;