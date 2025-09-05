// FIX: Added reference to node types to resolve issue with 'process.exit' not being found.
/// <reference types="node" />

// FIX: Changed import to just import express to avoid type conflicts with node types.
// FIX: Import Request, Response, and NextFunction for proper typing of route handlers.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Knex } from 'knex';
import { UserRole } from '@masuma-ea/types';


dotenv.config();

// --- START OF RBAC TYPES (Duplicated from frontend for backend use) ---
// This is now imported from @masuma-ea/types
// --- END OF RBAC TYPES ---

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    process.exit(1);
}

const googleAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(express.json());

// Trust the proxy to get the real client IP. This is crucial for IP whitelisting.
app.set('trust proxy', true);

// Serve static files for uploaded documents
app.use('/uploads', express.static(uploadsDir));


// --- Multer Setup for File Uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// A simple utility to add -dev to uuid for readability
const newId = () => uuidv4();

// --- Validation Helpers ---
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
const isValidKraPin = (pin: string): boolean => {
    const pinRegex = /^[A-Z][0-9]{9}[A-Z]$/;
    return pinRegex.test(pin);
}

// --- Settings Helper ---
const getAppSettings = async (dbInstance: Knex): Promise<any> => {
    const defaultSettings = {
        companyName: 'Masuma Autoparts East Africa',
        companyAddress: '123 Industrial Area, Nairobi, Kenya',
        companyPhone: '+254 700 123 456',
        companyKraPin: 'P000000000X',
        taxRate: 16,
        invoiceDueDays: 30,
        lowStockThreshold: 10,
        salesTarget: 5000000,
        mpesaPaybill: '',
        mpesaConsumerKey: '',
        mpesaConsumerSecret: '',
        mpesaPasskey: '',
    };

    try {
        const rows = await dbInstance('app_settings').select('setting_key', 'setting_value');
        if (!rows || rows.length === 0) {
            return defaultSettings;
        }
        
        const settingsFromDb = rows.reduce((acc, row) => {
            const keyMap: { [key: string]: string } = {
                company_name: 'companyName',
                company_address: 'companyAddress',
                company_phone: 'companyPhone',
                company_kra_pin: 'companyKraPin',
                tax_rate: 'taxRate',
                invoice_due_days: 'invoiceDueDays',
                low_stock_threshold: 'lowStockThreshold',
                sales_target: 'salesTarget',
                mpesa_paybill: 'mpesaPaybill',
                mpesa_consumer_key: 'mpesaConsumerKey',
                mpesa_consumer_secret: 'mpesaConsumerSecret',
                mpesa_passkey: 'mpesaPasskey',
            };
            const camelCaseKey = keyMap[row.setting_key] || row.setting_key;

            const isNumeric = ['tax_rate', 'invoice_due_days', 'low_stock_threshold', 'sales_target'].includes(row.setting_key) && !isNaN(parseFloat(row.setting_value));
            acc[camelCaseKey] = isNumeric ? Number(row.setting_value) : row.setting_value;
            return acc;
        }, {} as any);
        
        return { ...defaultSettings, ...settingsFromDb };
    } catch (error) {
        console.error("Could not fetch app settings, using defaults.", error);
        return defaultSettings;
    }
};



// --- JWT & RBAC Middleware ---
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Forbidden: No role attached to user' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

// --- Reusable Sale Creation Logic ---
async function createSaleFromPayload(payload: any, trx: Knex.Transaction) {
    const { customerId, branchId, items, discount, paymentMethod, invoiceId } = payload;
    
    try {
        const settings = await getAppSettings(trx);
        
        const subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
        const subtotalAfterDiscount = subtotal - (discount || 0);
        const taxRate = settings.taxRate / 100;
        const taxAmount = subtotalAfterDiscount * taxRate;
        const totalAmount = subtotalAfterDiscount + taxAmount;

        const saleNo = `SALE-${Date.now()}`;
        const [saleId] = await trx('sales').insert({
            sale_no: saleNo,
            customer_id: customerId,
            branch_id: branchId,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            invoice_id: invoiceId || null
        });

        for (const item of items) {
            await trx('sale_items').insert({
                sale_id: saleId,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice
            });
            await trx('products').where('id', item.productId).decrement('stock', item.quantity);
        }
        
        if (invoiceId) {
            await trx('invoices').where('id', invoiceId).update({
                amount_paid: db.raw('amount_paid + ?', [totalAmount]),
                status: 'Paid'
            });
        }
        
        const saleDetails = await trx('sales as s')
          .join('customers as c', 's.customer_id', 'c.id')
          .join('branches as b', 's.branch_id', 'b.id')
          .select(
            's.id', 's.sale_no', 's.created_at', 's.total_amount as amount', 's.tax_amount', 's.payment_method',
            'c.id as customer_id', 'c.name as customer_name',
            'b.id as branch_id', 'b.name as branch_name', 'b.address as branch_address', 'b.phone as branch_phone'
          )
          .where('s.id', saleId)
          .first();

        const itemDetails = await trx('sale_items as si')
          .join('products as p', 'si.product_id', 'p.id')
          .select('si.id', 'si.quantity', 'si.unit_price', 'p.name as product_name', 'p.part_number')
          .where('si.sale_id', saleId);
        
        const saleResponse = saleDetails;
        saleResponse.customer = { id: saleResponse.customer_id, name: saleResponse.customer_name };
        saleResponse.branch = { id: saleResponse.branch_id, name: saleResponse.branch_name, address: saleResponse.branch_address, phone: saleResponse.branch_phone };
        saleResponse.items = itemDetails;

        return saleResponse;
    } catch (error) {
        console.error("Sale creation error:", error);
        throw new Error('Failed to create sale');
    }
}


// --- PUBLIC API ROUTES (e.g., Callbacks) ---

// Safaricom's official public IPs for Daraja API callbacks.
const SAFARICOM_IPS = [
    '196.201.214.200', '196.201.214.206', '196.201.214.207', 
    '196.201.214.208', '196.201.214.209', '196.201.214.212', 
    '196.201.214.213', '196.201.214.214'
];

/**
 * Middleware to verify that the M-Pesa callback is from a genuine Safaricom IP address.
 */
const verifySafaricomIp = (req: Request, res: Response, next: NextFunction) => {
    // Bypass IP check in non-production environments for easier local testing.
    if (process.env.NODE_ENV !== 'production') {
        console.log("Bypassing Safaricom IP check in development mode.");
        return next();
    }

    const requestIp = req.ip;
    console.log(`Received M-Pesa callback from IP: ${requestIp}`);

    if (requestIp && SAFARICOM_IPS.includes(requestIp)) {
        return next();
    }
    
    console.warn(`WARN: Denied M-Pesa callback from untrusted IP: ${requestIp}`);
    res.status(403).json({ message: 'Forbidden: Invalid request origin.' });
};


app.post('/api/payments/mpesa/callback', verifySafaricomIp, async (req: Request, res: Response) => {
    console.log('--- M-PESA Callback Received ---');
    console.log(JSON.stringify(req.body, null, 2));

    // --- PRODUCTION SECURITY ---
    // This endpoint is now protected by an IP whitelist middleware (`verifySafaricomIp`).
    // For a truly secure system, the next step is to implement signature validation
    // as per Safaricom's Daraja documentation. This involves:
    // 1. Concatenating the full request body as a string.
    // 2. Creating a digital signature of the body using your private key.
    // 3. Verifying this signature against the one provided in the `X-Safaricom-Signature` header using Safaricom's public key.
    // This prevents man-in-the-middle attacks and ensures the payload has not been tampered with.
    
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
        // This might be a timeout or other callback type. Acknowledge and log it.
        console.log("Received a non-STK callback or invalid body.");
        return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;

    try {
        await db.transaction(async (trx) => {
            if (ResultCode !== 0) {
                // Transaction failed or was cancelled by the user.
                await trx('mpesa_transactions')
                    .where('checkout_request_id', CheckoutRequestID)
                    .update({ status: "Failed", result_desc: ResultDesc || 'Callback indicated failure.' });
            } else {
                // Transaction was successful.
                const mpesaReceiptNumber = CallbackMetadata?.Item?.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
                
                const tx = await trx('mpesa_transactions')
                    .where({ checkout_request_id: CheckoutRequestID, status: 'Pending' })
                    .first();

                if (!tx) {
                     console.log(`Callback for already processed or unknown CheckoutRequestID: ${CheckoutRequestID}`);
                     return; // Commit transaction
                }
                
                if (tx.invoice_id) { // This is an invoice payment
                    await trx('invoices')
                        .where('id', tx.invoice_id)
                        .update({ 
                            amount_paid: db.raw('amount_paid + ?', [tx.amount]), 
                            status: 'Paid' 
                        });
                } else { // This is a POS payment
                    const salePayload = { ...JSON.parse(tx.transaction_details), paymentMethod: 'MPESA', items: JSON.parse(tx.transaction_details).cart.map((item:any) => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.retailPrice })) };
                    const sale = await createSaleFromPayload(salePayload, trx);
                    await trx('mpesa_transactions').where('id', tx.id).update({ sale_id: sale.id });
                }
                await trx('mpesa_transactions').where('id', tx.id).update({ 
                    status: 'Completed', 
                    mpesa_receipt_number: mpesaReceiptNumber, 
                    result_desc: 'Completed Successfully' 
                });
            }
        });
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (e) { 
        console.error('M-Pesa callback processing error:', e); 
        // Acknowledge the callback to prevent Safaricom from resending.
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
});


// --- AUTH ROUTES (Unprotected) ---
const authRouter = express.Router();

authRouter.post('/register', upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), async (req: Request, res: Response) => {
    const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // --- Validation ---
    if (!businessName || !kraPin || !contactName || !contactEmail || !contactPhone || !password || !files.certOfInc || !files.cr12) {
        return res.status(400).json({ message: "All fields and documents are required." });
    }
    if (!isValidEmail(contactEmail)) {
        return res.status(400).json({ message: "Invalid email format." });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }
     if (!isValidKraPin(kraPin)) {
        return res.status(400).json({ message: "Invalid KRA PIN format." });
    }
    // --- End Validation ---

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db('b2b_applications').insert({
            id: newId(),
            business_name: businessName,
            kra_pin: kraPin,
            contact_name: contactName,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            password_hash: hashedPassword,
            cert_of_inc_url: files.certOfInc[0].filename,
            cr12_url: files.cr12[0].filename,
            status: 'Pending'
        });
        res.status(201).json({ message: "Application submitted successfully." });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Database error during registration.' });
    }
});

authRouter.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required."});
    try {
        const user = await db('users as u')
            .leftJoin('b2b_applications as b', 'u.b2b_application_id', 'b.id')
            .select(
                'u.id', 'u.email', 'u.name', 'u.role', 'u.status', 'u.password_hash',
                'b.id as businessId', 'b.business_name as businessName'
            )
            .where('u.email', email)
            .where('u.status', 'Active')
            .first();

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: 'Invalid credentials or account inactive' });
        }
        const token = jwt.sign(
          { userId: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
          JWT_SECRET, { expiresIn: '8h' }
        );
        res.json({ token });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

authRouter.post('/google-login', async (req: Request, res: Response) => {
    const { token: googleToken } = req.body;
    if (!googleToken) {
        return res.status(400).json({ message: "Google token is required." });
    }

    try {
        const ticket = await googleAuthClient.verifyIdToken({
            idToken: googleToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email || !payload.name) {
            return res.status(401).json({ message: 'Invalid Google token.' });
        }
        
        const { email, name } = payload;
        
        let user = await db('users').where({ email }).first();

        if (!user) {
            // User does not exist, create a new one
            const newUserId = newId();
            // Default new Google sign-up users to a basic role
            const defaultRole = UserRole.SALES_STAFF;
            await db('users').insert({
                id: newUserId,
                name,
                email,
                role: defaultRole,
                status: 'Active'
            });
            user = { id: newUserId, email, name, role: defaultRole, status: 'Active' };
        }
        
        if (user.status !== 'Active') {
            return res.status(403).json({ message: "Your account is currently inactive." });
        }

        const appToken = jwt.sign(
            { userId: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        res.json({ token: appToken });
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        res.status(500).json({ message: 'Google Sign-In failed. Please try again.' });
    }
});

app.use('/api/auth', authRouter);

// --- PROTECTED API ROUTES ---
const apiRouter = express.Router();
apiRouter.use(authenticateToken); // All routes below this point are protected

// B2B Management
apiRouter.get('/b2b/applications', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const applications = await db('b2b_applications')
        .select(
            'id', 
            'business_name AS businessName', 
            'kra_pin AS kraPin', 
            'contact_name AS contactName', 
            'contact_email AS contactEmail', 
            'contact_phone AS contactPhone', 
            'cert_of_inc_url AS certOfIncUrl', 
            'cr12_url AS cr12Url', 
            'status', 
            'submitted_at as submittedAt'
        )
        .orderBy('submitted_at', 'desc');
    res.json(applications);
});
apiRouter.patch('/b2b/applications/:id/status', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.transaction(async trx => {
            await trx('b2b_applications').where({ id }).update({ status });
            if (status === 'Approved') {
                const app = await trx('b2b_applications').where({ id }).first();
                if (app) {
                    const existingUser = await trx('users').where('email', app.contact_email).first();
                    if (!existingUser) {
                         await trx('users').insert({
                            id: newId(),
                            name: app.contact_name,
                            email: app.contact_email,
                            password_hash: app.password_hash,
                            role: UserRole.SALES_STAFF, // Default B2B role
                            b2b_application_id: id,
                            status: 'Active'
                         });
                    }
                }
            }
        });
        const updatedApp = await db('b2b_applications').where({ id }).select(
            'id', 'business_name AS businessName', 'kra_pin AS kraPin', 'contact_name AS contactName', 
            'contact_email AS contactEmail', 'contact_phone AS contactPhone', 'cert_of_inc_url AS certOfIncUrl', 
            'cr12_url AS cr12Url', 'status', 'submitted_at as submittedAt'
        ).first();
        res.json(updatedApp);
    } catch (error) { res.status(500).json({ message: "Failed to update application status" }); }
});

// User Management
apiRouter.get('/users', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR]), async (req: Request, res: Response) => {
    const users = await db('users').select("id", "name", "email", "role", "status").orderBy("name", "asc");
    res.json(users);
});
apiRouter.post('/users', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR]), async (req: Request, res: Response) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ message: 'All fields are required.' });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format."});
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters."});
    if (!Object.values(UserRole).includes(role)) return res.status(400).json({ message: "Invalid user role."});

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: newId(), name, email, role, status: 'Active' as 'Active' | 'Inactive' };
        await db('users').insert({ ...newUser, password_hash: hashedPassword });
        res.status(201).json(newUser);
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists.' });
        res.status(500).json({ message: 'Failed to create user' });
    }
});
apiRouter.patch('/users/:id', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR]), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    if (req.user.userId === id && status === 'Inactive') return res.status(403).json({ message: "You cannot deactivate your own account." });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format."});
    if (!Object.values(UserRole).includes(role)) return res.status(400).json({ message: "Invalid user role."});
    if (!['Active', 'Inactive'].includes(status)) return res.status(400).json({ message: "Invalid status."});

    try {
        await db('users').where({ id }).update({ name, email, role, status });
        const user = await db('users').select("id", "name", "email", "role", "status").where({ id }).first();
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists.' });
        res.status(500).json({ message: 'Failed to update user' });
    }
});
apiRouter.patch('/users/me/password', async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "All fields are required." });
    if (newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters long."});
    
    try {
        const user = await db('users').select('password_hash').where({ id: req.user.userId }).first();
        if (!user) return res.status(404).json({ message: 'User not found.' });
        if (!user.password_hash) return res.status(401).json({ message: 'Cannot change password for accounts created via Google Sign-In.'});

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) return res.status(401).json({ message: 'Incorrect current password.' });
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db('users').where({ id: req.user.userId }).update({ password_hash: hashedNewPassword });
        res.json({ message: 'Password updated successfully.' });
    } catch (error) { res.status(500).json({ message: 'Server error while updating password.' }); }
});

// Inventory
apiRouter.get('/inventory/products', async (req: Request, res: Response) => {
    const products = await db('products').select("id", "part_number as partNumber", "name", "retail_price as retailPrice", "wholesale_price as wholesalePrice", "stock").orderBy("name", "asc");
    res.json(products);
});
apiRouter.post('/inventory/products', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { partNumber, name, retailPrice, wholesalePrice, stock } = req.body;
    if (!partNumber || !name || retailPrice === undefined || wholesalePrice === undefined || stock === undefined) {
        return res.status(400).json({ message: "All product fields are required." });
    }
    if (isNaN(retailPrice) || isNaN(wholesalePrice) || isNaN(stock) || retailPrice < 0 || wholesalePrice < 0 || stock < 0) {
        return res.status(400).json({ message: "Prices and stock must be non-negative numbers."});
    }

    const newProduct = { id: newId(), partNumber, name, retailPrice, wholesalePrice, stock };
    await db('products').insert({
        id: newProduct.id,
        part_number: newProduct.partNumber,
        name: newProduct.name,
        retail_price: newProduct.retailPrice,
        wholesale_price: newProduct.wholesalePrice,
        stock: newProduct.stock,
    });
    res.status(201).json(newProduct);
});
apiRouter.patch('/inventory/products/:id', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { partNumber, name, retailPrice, wholesalePrice, stock } = req.body;

    if (!partNumber || !name || retailPrice === undefined || wholesalePrice === undefined || stock === undefined) {
        return res.status(400).json({ message: "All product fields are required." });
    }
    if (isNaN(retailPrice) || isNaN(wholesalePrice) || isNaN(stock) || retailPrice < 0 || wholesalePrice < 0 || stock < 0) {
        return res.status(400).json({ message: "Prices and stock must be non-negative numbers."});
    }

    try {
        await db('products').where({ id }).update({ part_number: partNumber, name, retail_price: retailPrice, wholesale_price: wholesalePrice, stock });
        const product = await db('products').select("id", "part_number as partNumber", "name", "retail_price as retailPrice", "wholesale_price as wholesalePrice", "stock").where({ id }).first();
        res.json(product);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ message: 'Database error during product update.' });
    }
});

apiRouter.post('/inventory/products/bulk', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const products = req.body.map((p: any) => ({
        id: newId(),
        part_number: p.partNumber,
        name: p.name,
        retail_price: p.retailPrice,
        wholesale_price: p.wholesalePrice,
        stock: p.stock
    }));

    try {
        await db('products')
            .insert(products)
            .onConflict('part_number')
            .merge(['name', 'retail_price', 'wholesale_price', 'stock']);
        res.json({ message: 'Bulk import successful' });
    } catch (error) { 
        res.status(500).json({ message: 'Bulk import failed', error }); 
    } 
});

// VIN Picker
apiRouter.get('/vin-picker/:vin', async (req: Request, res: Response) => {
    const { vin } = req.params;
    if (!vin || vin.length < 5) {
        return res.status(400).json({ message: "A valid VIN is required." });
    }
    try {
        // SIMULATION: In a real system, you'd have a mapping table (vin_to_parts)
        // or an external API. Here, we'll simulate a lookup by using a portion
        // of the VIN to search for matching part numbers or names. This is NOT a real
        // VIN lookup but demonstrates a functional API endpoint.
        const searchTerm = `%${vin.substring(vin.length - 4)}%`; // Use last 4 chars of VIN
        const rows = await db('products')
            .select('id', 'part_number as partNumber', 'name', 'stock')
            .where('part_number', 'like', searchTerm)
            .orWhere('name', 'like', searchTerm)
            .limit(5);
        
        // Add mock compatibility string for display
        const results = rows.map(row => ({
            ...row,
            compatibility: `Compatible with vehicles ending in ...${vin.slice(-6)} (Simulated)`
        }));

        res.json(results);
    } catch (error) {
        console.error("VIN Picker search error:", error);
        res.status(500).json({ message: 'Error searching for parts.' });
    }
});

// General Data
apiRouter.get('/data/customers', async (req: Request, res: Response) => {
    const customers = await db('customers').select('id', 'name', 'address', 'phone', 'kra_pin as kraPin');
    res.json(customers);
});
apiRouter.post('/data/customers', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF]), async (req: Request, res: Response) => {
    const { name, address, phone, kraPin } = req.body;
    if (!name || !address || !phone) {
        return res.status(400).json({ message: "Name, address, and phone are required."});
    }
    const [id] = await db('customers').insert({ name, address, phone, kra_pin: kraPin || null });
    res.status(201).json({ id, name, address, phone, kraPin });
});
apiRouter.get('/data/branches', async (req: Request, res: Response) => {
    const branches = await db('branches').select('id', 'name', 'address', 'phone');
    res.json(branches);
});
apiRouter.get('/data/sales', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    let query = db('sales as s')
        .select(
            's.id', 's.sale_no', 's.customer_id', 's.branch_id', 's.created_at', 
            's.total_amount as amount', 
            db.raw('(SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items')
        );

    if (startDate && endDate) {
        // Inclusive of start and end date
        query.where('s.created_at', '>=', startDate as string)
             .where('s.created_at', '<=', `${endDate as string} 23:59:59`);
    }
    query.orderBy('s.created_at', 'desc');
    const sales = await query;
    res.json(sales);
});
apiRouter.get('/data/invoices', async (req: Request, res: Response) => {
    const invoices = await db('invoices').select('id', 'invoice_no').where('status', 'Unpaid').orderBy('created_at', 'desc');
    res.json(invoices);
});

// POS
apiRouter.post('/pos/sales', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF]), async (req: Request, res: Response) => {
    try {
        const saleData = await db.transaction(async (trx) => {
            return createSaleFromPayload(req.body, trx);
        });
        res.status(201).json(saleData);
    } catch (error) { 
        res.status(500).json({ message: 'Failed to create sale' }); 
    }
});

// Shipping
apiRouter.get('/shipping/labels', async (req: Request, res: Response) => {
    const labels = await db('shipping_labels').select('*').orderBy('created_at', 'desc');
    res.json(labels);
});
apiRouter.post('/shipping/labels', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF, UserRole.WAREHOUSE_CLERK, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const labelData = { id: newId(), status: 'Draft', ...req.body };
    await db('shipping_labels').insert(labelData);
    res.status(201).json(labelData);
});
apiRouter.patch('/shipping/labels/:id/status', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF, UserRole.WAREHOUSE_CLERK, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { id } = req.params; const { status } = req.body;
    await db('shipping_labels').where({ id }).update({ status });
    const updated = await db('shipping_labels').where({ id }).first();
    res.json(updated);
});

// --- Quotations & Invoices (FULLY IMPLEMENTED) ---
const VIEW_FINANCIALS_ROLES = [UserRole.SALES_STAFF, UserRole.ACCOUNTANT, UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER];
const MANAGE_FINANCIALS_ROLES = [UserRole.SALES_STAFF, UserRole.SYSTEM_ADMINISTRATOR];

apiRouter.get('/quotations', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const quotations = await db('quotations as q')
        .join('customers as c', 'q.customer_id', 'c.id')
        .select('q.id', 'q.quotation_no', 'q.customer_id', 'q.branch_id', 'q.created_at', 'q.valid_until', 'q.status', 'q.total_amount as amount', 'c.name as customerName')
        .orderBy('q.created_at', 'desc');
    res.json(quotations);
});

apiRouter.get('/quotations/:id', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const quotation = await db('quotations as q')
            .join('customers as c', 'q.customer_id', 'c.id')
            .join('branches as b', 'q.branch_id', 'b.id')
            .select('q.*', 'c.name as customer_name', 'c.address as customer_address', 'c.phone as customer_phone', 'b.name as branch_name', 'b.address as branch_address', 'b.phone as branch_phone')
            .where('q.id', id).first();

        if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
        
        const items = await db('quotation_items as qi').join('products as p', 'qi.product_id', 'p.id').select('qi.*', 'p.name as product_name', 'p.part_number').where('qi.quotation_id', id);
        
        const response = {
            id: quotation.id, quotation_no: quotation.quotation_no, customer_id: quotation.customer_id, branch_id: quotation.branch_id, created_at: quotation.created_at, valid_until: quotation.valid_until, status: quotation.status, amount: quotation.total_amount,
            customer: { id: quotation.customer_id, name: quotation.customer_name, address: quotation.customer_address, phone: quotation.customer_phone, kraPin: quotation.customer_kra_pin },
            branch: { id: quotation.branch_id, name: quotation.branch_name, address: quotation.branch_address, phone: quotation.branch_phone },
            items: items,
        };
        res.json(response);
    } catch (error) { res.status(500).json({ message: "Server error fetching quotation details" }); }
});

apiRouter.post('/quotations', authorizeRole(MANAGE_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { customerId, branchId, items, validUntil } = req.body;
    if (!customerId || !branchId || !items || !validUntil || items.length === 0) return res.status(400).json({ message: "Missing required fields for quotation." });
    
    try {
        const newQuotation = await db.transaction(async trx => {
            const totalAmount = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
            
            const now = new Date();
            const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const likePattern = `QUO-${datePrefix}-%`;
            const countResult = await trx('quotations').where('quotation_no', 'like', likePattern).count({ count: '*' }).first();
            const nextSequence = String((Number(countResult?.count) || 0) + 1).padStart(4, '0');
            const quotationNo = `QUO-${datePrefix}-${nextSequence}`;

            const [quotationId] = await trx('quotations').insert({ quotation_no: quotationNo, customer_id: customerId, branch_id: branchId, valid_until: validUntil, total_amount: totalAmount, status: 'Draft' });
            const itemPayloads = items.map((item: any) => ({ quotation_id: quotationId, product_id: item.productId, quantity: item.quantity, unit_price: item.unitPrice }));
            if(itemPayloads.length > 0) await trx('quotation_items').insert(itemPayloads);
            
            return trx('quotations as q').join('customers as c', 'q.customer_id', 'c.id').select('q.id', 'q.quotation_no', 'q.customer_id', 'q.branch_id', 'q.created_at', 'q.valid_until', 'q.status', 'q.total_amount as amount', 'c.name as customerName').where('q.id', quotationId).first();
        });
        res.status(201).json(newQuotation);
    } catch (error) { res.status(500).json({ message: "Failed to create quotation" }); }
});

apiRouter.patch('/quotations/:id/status', authorizeRole(MANAGE_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params; const { status } = req.body;
    try {
        await db('quotations').where({ id }).update({ status });
        const quotation = await db('quotations as q').join('customers as c', 'q.customer_id', 'c.id').select('q.id', 'q.quotation_no', 'q.customer_id', 'q.branch_id', 'q.created_at', 'q.valid_until', 'q.status', 'q.total_amount as amount', 'c.name as customerName').where('q.id', id).first();
        if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
        res.json(quotation);
    } catch (error) { res.status(500).json({ message: "Failed to update quotation status" }); }
});

apiRouter.post('/quotations/:id/convert', authorizeRole(MANAGE_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const newInvoice = await db.transaction(async trx => {
            const quotation = await trx('quotations').where({ id }).first();
            if (!quotation) throw new Error('Quotation not found.');
            if (quotation.status !== 'Accepted') throw new Error('Only accepted quotations can be converted.');
            const existingInvoice = await trx('invoices').where('quotation_id', id).first();
            if (existingInvoice) throw new Error('Invoice already created for this quotation.');

            const quoteItems = await trx('quotation_items').where('quotation_id', id);
            const settings = await getAppSettings(trx);
            const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + settings.invoiceDueDays);
            const invoiceNo = `INV-${Date.now()}`;
            
            const [invoiceId] = await trx('invoices').insert({ invoice_no: invoiceNo, customer_id: quotation.customer_id, branch_id: quotation.branch_id, quotation_id: id, due_date: dueDate.toISOString().split('T')[0], total_amount: quotation.total_amount, status: 'Unpaid'});
            const invoiceItemPayloads = quoteItems.map(item => ({ invoice_id: invoiceId, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price }));
            if(invoiceItemPayloads.length > 0) await trx('invoice_items').insert(invoiceItemPayloads);
            await trx('quotations').where({ id }).update({ status: 'Invoiced' });
            return trx('invoices').where({ id: invoiceId }).first();
        });
        res.status(201).json(newInvoice);
    } catch (error: any) { res.status(500).json({ message: error.message || "Failed to convert quotation" }); } 
});

apiRouter.get('/invoices', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { status } = req.query;
    let query = db('invoices as i').join('customers as c', 'i.customer_id', 'c.id').select('i.id', 'i.invoice_no', 'i.customer_id', 'i.branch_id', 'i.created_at', 'i.due_date', 'i.status', 'i.total_amount as amount', 'c.name as customerName');
    if (status && status !== 'All') { query.where('i.status', status as string); }
    query.orderBy('i.created_at', 'desc');
    const invoices = await query;
    res.json(invoices);
});

apiRouter.get('/invoices/:id', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const invoice = await db('invoices as i').join('customers as c', 'i.customer_id', 'c.id').join('branches as b', 'i.branch_id', 'b.id').select('i.*', 'c.name as customer_name', 'c.address as customer_address', 'c.phone as customer_phone', 'c.kra_pin as customer_kra_pin', 'b.name as branch_name', 'b.address as branch_address', 'b.phone as branch_phone').where('i.id', id).first();
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
        
        const items = await db('invoice_items as ii').join('products as p', 'ii.product_id', 'p.id').select('ii.*', 'p.name as product_name', 'p.part_number').where('ii.invoice_id', id);
        
        const response = {
            id: invoice.id, invoice_no: invoice.invoice_no, customer_id: invoice.customer_id, branch_id: invoice.branch_id, created_at: invoice.created_at, due_date: invoice.due_date, status: invoice.status, amount: invoice.total_amount, amount_paid: invoice.amount_paid, quotation_id: invoice.quotation_id,
            customer: { id: invoice.customer_id, name: invoice.customer_name, address: invoice.customer_address, phone: invoice.customer_phone, kraPin: invoice.customer_kra_pin },
            branch: { id: invoice.branch_id, name: invoice.branch_name, address: invoice.branch_address, phone: invoice.branch_phone },
            items: items,
        };
        res.json(response);
    } catch (error) { res.status(500).json({ message: "Server error fetching invoice details" }); }
});

// Dashboard
apiRouter.get('/dashboard/stats', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as { startDate: string, endDate: string };
    try {
        const sales = await db('sales').where('created_at', '>=', startDate).andWhere('created_at', '<=', `${endDate} 23:59:59`).sum('total_amount as total').count('id as count').first();
        const customers = await db('sales').where('created_at', '>=', startDate).andWhere('created_at', '<=', `${endDate} 23:59:59`).countDistinct('customer_id as count').first();
        const shipments = await db('shipping_labels').where('created_at', '>=', startDate).andWhere('created_at', '<=', `${endDate} 23:59:59`).count('id as total').sum(db.raw('CASE WHEN status="Draft" THEN 1 ELSE 0 END as pending')).first();
        const settings = await getAppSettings(db);
        res.json({ totalRevenue: sales?.total || 0, totalSales: sales?.count || 0, activeCustomers: customers?.count || 0, totalShipments: shipments?.total || 0, pendingShipments: shipments?.pending || 0, salesTarget: settings.salesTarget });
    } catch(error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: "Failed to load dashboard statistics." });
    }
});
apiRouter.post('/dashboard/sales-target', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { target } = req.body;
    if (target === undefined || typeof target !== 'number' || target < 0) {
        return res.status(400).json({ message: "A valid, non-negative target number is required." });
    }
    try {
        await db('app_settings').insert({ setting_key: 'sales_target', setting_value: target }).onConflict('setting_key').merge();
        res.json({ salesTarget: target });
    } catch (error) {
        console.error("Failed to update sales target:", error);
        res.status(500).json({ message: "Failed to update sales target." });
    }
});
apiRouter.get('/dashboard/sales-chart', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as { startDate: string, endDate: string };
    const data = await db('sales')
        .select(db.raw('DATE(created_at) as name'))
        .sum('total_amount as revenue')
        .count('id as sales')
        .where('created_at', '>=', startDate).andWhere('created_at', '<=', `${endDate} 23:59:59`)
        .groupBy('name')
        .orderBy('name', 'asc');
    res.json(data);
});

// Notifications
apiRouter.get('/notifications', async (req: Request, res: Response) => {
    const { lastCheck } = req.query;
    const serverTimestamp = new Date().toISOString();
    const settings = await getAppSettings(db);
    
    let newAppsQuery = db('b2b_applications').select('id', 'business_name as businessName', 'status').where('status', 'Pending');
    if (lastCheck) newAppsQuery.where('submitted_at', '>', lastCheck as string);
    const newApps = await newAppsQuery;
    
    const lowStock = await db('products').select('id', 'name', 'stock').where('stock', '<', settings.lowStockThreshold).where('stock', '>', 0);
    res.json({ newApplications: newApps, lowStockProducts: lowStock, serverTimestamp: serverTimestamp });
});

// Settings
apiRouter.get('/settings', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const settings = await getAppSettings(db); res.json(settings);
});
apiRouter.patch('/settings', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const settingsToUpdate = req.body;
    try {
        await db.transaction(async trx => {
            for (const key in settingsToUpdate) {
                const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                const value = settingsToUpdate[key];
                await trx('app_settings').insert({ setting_key: snakeCaseKey, setting_value: String(value) }).onConflict('setting_key').merge();
            }
        });
        res.json(await getAppSettings(db));
    } catch (error) { res.status(500).json({ message: "Failed to update settings" }); } 
});

// --- M-PESA PAYMENTS ---
apiRouter.post('/payments/mpesa/initiate', async (req: Request, res: Response) => {
    const { amount, phoneNumber, cart, customerId, branchId, invoiceId } = req.body;
    const checkoutRequestId = `crq_${uuidv4()}`;
    const merchantRequestId = `mrq_${uuidv4()}`;
    try {
        const transactionDetails = { cart, customerId, branchId, discount: req.body.discount, taxAmount: req.body.taxAmount, totalAmount: req.body.totalAmount };
        await db('mpesa_transactions').insert({
            checkout_request_id: checkoutRequestId,
            merchant_request_id: merchantRequestId,
            amount: amount,
            phone_number: phoneNumber,
            invoice_id: invoiceId || null,
            transaction_details: JSON.stringify(transactionDetails),
            status: 'Pending'
        });
        
        console.log(`Transaction ${checkoutRequestId} initiated. Waiting for Safaricom callback.`);

        res.json({ checkoutRequestId });
    } catch (error: any) { 
        console.error("M-Pesa initiation error:", error);
        res.status(500).json({ message: error.message || 'Failed to initiate M-Pesa payment.' }); 
    }
});


apiRouter.get('/payments/mpesa/status/:checkoutRequestId', async (req: Request, res: Response) => {
    const { checkoutRequestId } = req.params;
    try {
        const tx = await db('mpesa_transactions').where({ checkout_request_id: checkoutRequestId }).first();
        if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

        if (tx.status === 'Completed' && tx.sale_id) {
            const saleDetails = await db('sales as s').join('customers as c', 's.customer_id', 'c.id').join('branches as b', 's.branch_id', 'b.id').select('s.id', 's.sale_no', 's.created_at', 's.total_amount as amount', 's.tax_amount', 's.payment_method', 'c.id as customer_id', 'c.name as customer_name', 'b.id as branch_id', 'b.name as branch_name', 'b.address as branch_address', 'b.phone as branch_phone').where('s.id', tx.sale_id).first();
            const itemDetails = await db('sale_items as si').join('products as p', 'si.product_id', 'p.id').select('si.id', 'si.quantity', 'si.unit_price', 'p.name as product_name', 'p.part_number').where('si.sale_id', tx.sale_id);
            const saleResponse = saleDetails;
            saleResponse.customer = { id: saleResponse.customer_id, name: saleResponse.customer_name };
            saleResponse.branch = { id: saleResponse.branch_id, name: saleResponse.branch_name, address: saleResponse.branch_address, phone: saleResponse.branch_phone };
            saleResponse.items = itemDetails;
            res.json({ status: 'Completed', sale: saleResponse });
        } else {
            res.json({ status: tx.status, message: tx.result_desc });
        }
    } catch (error) { res.status(500).json({ message: 'Error checking payment status.' }); }
});

app.use('/api', apiRouter);

// --- STATIC FILE SERVING ---
if (process.env.NODE_ENV === 'production') {
    // In production, serve the built frontend files from the 'dist' directory of the frontend workspace.
    const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
    
    app.use(express.static(frontendDistPath));

    // For any route that doesn't match an API route or a static file, serve the frontend's index.html.
    // This is crucial for single-page applications with client-side routing.
    app.get('*', (req: Request, res: Response) => {
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(404).json({ message: 'API endpoint not found.' });
        }
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}


app.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
});
