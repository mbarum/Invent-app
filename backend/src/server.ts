// FIX: Added reference to node types to resolve issue with 'process.exit' not being found.
/// <reference types="node" />

// FIX: Use qualified express types to avoid conflicts with global types.
// FIX: Changed import to use default export and qualified types to prevent global type conflicts.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db';
import { FieldPacket, RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

// --- START OF RBAC TYPES (Duplicated from frontend for backend use) ---
export enum UserRole {
  SYSTEM_ADMINISTRATOR = 'System Administrator',
  INVENTORY_MANAGER = 'Inventory Manager',
  PROCUREMENT_OFFICER = 'Procurement Officer',
  SALES_STAFF = 'Sales / Counter Staff',
  WAREHOUSE_CLERK = 'Warehouse / Store Clerk',
  ACCOUNTANT = 'Accountant / Finance Officer',
  AUDITOR = 'Auditor',
}
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

// Serve static files from the uploads directory and the frontend build
app.use('/uploads', express.static(uploadsDir));
const frontendDistPath = path.join(__dirname, '..', '..', 'dist');
app.use(express.static(frontendDistPath));


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
const newId = () => uuidv4().substring(0, 13) + '-dev';

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
const getAppSettings = async (connection: any): Promise<any> => {
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
        const [rows] = await connection.query('SELECT setting_key, setting_value FROM app_settings');
        if (!rows || (rows as RowDataPacket[]).length === 0) {
            return defaultSettings;
        }
        
        const settingsFromDb = (rows as RowDataPacket[]).reduce((acc, row) => {
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
async function createSaleFromPayload(payload: any, connection: any) {
    const { customerId, branchId, items, discount, paymentMethod, invoiceId } = payload;
    
    await connection.beginTransaction();
    try {
        const settings = await getAppSettings(connection);
        
        const subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
        const subtotalAfterDiscount = subtotal - (discount || 0);
        const taxRate = settings.taxRate / 100;
        const taxAmount = subtotalAfterDiscount * taxRate;
        const totalAmount = subtotalAfterDiscount + taxAmount;

        const saleNo = `SALE-${Date.now()}`;
        const [saleResult]:[any, FieldPacket[]] = await connection.execute(
            'INSERT INTO sales (sale_no, customer_id, branch_id, tax_amount, total_amount, payment_method, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [saleNo, customerId, branchId, taxAmount, totalAmount, paymentMethod, invoiceId || null]
        );
        const saleId = saleResult.insertId;

        for (const item of items) {
            await connection.execute(
                'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [saleId, item.productId, item.quantity, item.unitPrice]
            );
            await connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.productId]);
        }
        
        if (invoiceId) {
            await connection.execute('UPDATE invoices SET amount_paid = amount_paid + ?, status = "Paid" WHERE id = ?', [totalAmount, invoiceId]);
        }

        await connection.commit();
        
        const [saleDetails] = await db.query(`
          SELECT s.id, s.sale_no, s.created_at, s.total_amount as amount, s.tax_amount, s.payment_method,
            c.id as customer_id, c.name as customer_name,
            b.id as branch_id, b.name as branch_name, b.address as branch_address, b.phone as branch_phone
          FROM sales s JOIN customers c ON s.customer_id = c.id JOIN branches b ON s.branch_id = b.id
          WHERE s.id = ?`, [saleId]);

        const [itemDetails] = await db.query(`
          SELECT si.id, si.quantity, si.unit_price, p.name as product_name, p.part_number
          FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`, [saleId]);
        
        const saleResponse = (saleDetails as any)[0];
        saleResponse.customer = { id: saleResponse.customer_id, name: saleResponse.customer_name };
        saleResponse.branch = { id: saleResponse.branch_id, name: saleResponse.branch_name, address: saleResponse.branch_address, phone: saleResponse.branch_phone };
        saleResponse.items = itemDetails;

        return saleResponse;
    } catch (error) {
        await connection.rollback();
        console.error("Sale creation error:", error);
        throw new Error('Failed to create sale');
    }
}


// --- PUBLIC API ROUTES (e.g., Callbacks) ---
app.post('/api/payments/mpesa/callback', async (req: Request, res: Response) => {
    console.log('--- M-PESA Callback Received ---');
    console.log(JSON.stringify(req.body, null, 2));

    // In a real app, you'd verify the callback source here.
    // For this simulation, we trust the incoming data from our own server.
    const { Body } = req.body;
    if (!Body || !Body.stkCallback || Body.stkCallback.ResultCode !== 0) {
        // Handle failed transaction
        const checkoutRequestId = Body?.stkCallback?.CheckoutRequestID;
        if (checkoutRequestId) {
            await db.query('UPDATE mpesa_transactions SET status = "Failed", result_desc = ? WHERE checkout_request_id = ?', 
            [Body?.stkCallback?.ResultDesc || 'Callback indicated failure.', checkoutRequestId]);
        }
        return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const checkoutRequestId = Body.stkCallback.CheckoutRequestID;
    const mpesaReceiptNumber = Body.stkCallback.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ? AND status = "Pending"', [checkoutRequestId]) as RowDataPacket[][];
        if (rows.length === 0) {
             console.log(`Callback for already processed or unknown CheckoutRequestID: ${checkoutRequestId}`);
             await connection.commit();
             return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }
        
        const tx = rows[0];
        
        if (tx.invoice_id) { // This is an invoice payment
            await connection.execute('UPDATE invoices SET amount_paid = amount_paid + ?, status = "Paid" WHERE id = ?', [tx.amount, tx.invoice_id]);
        } else { // This is a POS payment
            const salePayload = { ...JSON.parse(tx.transaction_details), paymentMethod: 'MPESA', items: JSON.parse(tx.transaction_details).cart.map((item:any) => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.retailPrice })) };
            const sale = await createSaleFromPayload(salePayload, connection);
            await connection.query('UPDATE mpesa_transactions SET sale_id = ? WHERE id = ?', [sale.id, tx.id]);
        }
        await connection.query('UPDATE mpesa_transactions SET status = "Completed", mpesa_receipt_number = ?, result_desc = "Completed Successfully" WHERE id = ?', [mpesaReceiptNumber, tx.id]);
        
        await connection.commit();
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (e) { 
        await connection.rollback();
        console.error('M-Pesa callback processing error:', e); 
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } finally { 
        connection.release(); 
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
        await db.execute(
            'INSERT INTO b2b_applications (id, business_name, kra_pin, contact_name, contact_email, contact_phone, password_hash, cert_of_inc_url, cr12_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), businessName, kraPin, contactName, contactEmail, contactPhone, hashedPassword, files.certOfInc[0].filename, files.cr12[0].filename, 'Pending']
        );
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
        const [rows] = await db.execute('SELECT u.id, u.email, u.name, u.role, u.status, u.password_hash, b.id as businessId, b.business_name as businessName FROM users u LEFT JOIN b2b_applications b ON u.b2b_application_id = b.id WHERE u.email = ? AND u.status = "Active"', [email]) as RowDataPacket[][];
        const user = rows[0];
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
        
        let [rows] = await db.execute('SELECT id, email, name, role, status FROM users WHERE email = ?', [email]) as RowDataPacket[][];
        // FIX: Type user as 'any' to allow reassignment with a plain object.
        let user: any = rows[0];

        if (!user) {
            // User does not exist, create a new one
            const newUserId = uuidv4();
            // Default new Google sign-up users to a basic role
            const defaultRole = UserRole.SALES_STAFF;
            await db.execute(
                'INSERT INTO users (id, name, email, role, status) VALUES (?, ?, ?, ?, ?)',
                [newUserId, name, email, defaultRole, 'Active']
            );
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
    const [rows] = await db.query('SELECT id, business_name AS businessName, kra_pin AS kraPin, contact_name AS contactName, contact_email AS contactEmail, contact_phone AS contactPhone, cert_of_inc_url AS certOfIncUrl, cr12_url AS cr12Url, status, submitted_at as submittedAt FROM b2b_applications ORDER BY submitted_at DESC');
    res.json(rows);
});
apiRouter.patch('/b2b/applications/:id/status', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE b2b_applications SET status = ? WHERE id = ?', [status, id]);
        if (status === 'Approved') {
            const [appRows] = await db.query('SELECT * FROM b2b_applications WHERE id = ?', [id]) as RowDataPacket[][];
            const app = appRows[0];
            if (app) {
                const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [app.contact_email]) as RowDataPacket[][];
                if (existingUser.length === 0) {
                     await db.execute('INSERT INTO users (id, name, email, password_hash, role, b2b_application_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), app.contact_name, app.contact_email, app.password_hash, UserRole.SALES_STAFF, id, 'Active']);
                }
            }
        }
        const [updatedApp] = await db.query('SELECT id, business_name AS businessName, kra_pin AS kraPin, contact_name AS contactName, contact_email AS contactEmail, contact_phone AS contactPhone, cert_of_inc_url AS certOfIncUrl, cr12_url AS cr12Url, status, submitted_at as submittedAt FROM b2b_applications WHERE id = ?', [id]);
        res.json((updatedApp as any)[0]);
    } catch (error) { res.status(500).json({ message: "Failed to update application status" }); }
});

// User Management
apiRouter.get('/users', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR]), async (req: Request, res: Response) => {
    const [users] = await db.query("SELECT id, name, email, role, status FROM users ORDER BY name ASC");
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
        const newUser = { id: uuidv4(), name, email, role, status: 'Active' };
        await db.execute('INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)', [newUser.id, name, email, hashedPassword, role, 'Active']);
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
        await db.execute('UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?', [name, email, role, status, id]);
        const [rows] = await db.query("SELECT id, name, email, role, status FROM users WHERE id = ?", [id]) as RowDataPacket[][];
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(rows[0]);
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
        const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.userId]) as RowDataPacket[][];
        if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
        const user = rows[0];
        if (!user.password_hash) return res.status(401).json({ message: 'Cannot change password for accounts created via Google Sign-In.'});

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) return res.status(401).json({ message: 'Incorrect current password.' });
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNewPassword, req.user.userId]);
        res.json({ message: 'Password updated successfully.' });
    } catch (error) { res.status(500).json({ message: 'Server error while updating password.' }); }
});

// Inventory
apiRouter.get('/inventory/products', async (req: Request, res: Response) => {
    const [rows] = await db.query("SELECT id, part_number as partNumber, name, retail_price as retailPrice, wholesale_price as wholesalePrice, stock FROM products ORDER BY name ASC");
    res.json(rows);
});
apiRouter.post('/inventory/products', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { partNumber, name, retailPrice, wholesalePrice, stock } = req.body;
    if (!partNumber || !name || retailPrice === undefined || wholesalePrice === undefined || stock === undefined) {
        return res.status(400).json({ message: "All product fields are required." });
    }
    if (isNaN(retailPrice) || isNaN(wholesalePrice) || isNaN(stock) || retailPrice < 0 || wholesalePrice < 0 || stock < 0) {
        return res.status(400).json({ message: "Prices and stock must be non-negative numbers."});
    }

    const id = newId();
    await db.query('INSERT INTO products (id, part_number, name, retail_price, wholesale_price, stock) VALUES (?, ?, ?, ?, ?, ?)', [id, partNumber, name, retailPrice, wholesalePrice, stock]);
    res.status(201).json({ id, partNumber, name, retailPrice, wholesalePrice, stock });
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
        await db.query(
            'UPDATE products SET part_number = ?, name = ?, retail_price = ?, wholesale_price = ?, stock = ? WHERE id = ?',
            [partNumber, name, retailPrice, wholesalePrice, stock, id]
        );
        const [rows] = await db.query("SELECT id, part_number as partNumber, name, retail_price as retailPrice, wholesale_price as wholesalePrice, stock FROM products WHERE id = ?", [id]);
        res.json((rows as any)[0]);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ message: 'Database error during product update.' });
    }
});

apiRouter.post('/inventory/products/bulk', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const products = req.body;
    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
        for (const p of products) {
            await connection.query(`INSERT INTO products (id, part_number, name, retail_price, wholesale_price, stock) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), retail_price=VALUES(retail_price), wholesale_price=VALUES(wholesale_price), stock=VALUES(stock)`, [newId(), p.partNumber, p.name, p.retailPrice, p.wholesalePrice, p.stock]);
        }
        await connection.commit();
        res.json({ message: 'Bulk import successful' });
    } catch (error) { await connection.rollback(); res.status(500).json({ message: 'Bulk import failed', error }); } 
    finally { connection.release(); }
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
        const [rows] = await db.query(
            `SELECT 
                id, 
                part_number as partNumber, 
                name, 
                stock 
             FROM products 
             WHERE part_number LIKE ? OR name LIKE ? 
             LIMIT 5`,
            [searchTerm, searchTerm]
        );
        
        // Add mock compatibility string for display
        const results = (rows as any[]).map(row => ({
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
    const [rows] = await db.query('SELECT id, name, address, phone, kra_pin as kraPin FROM customers');
    res.json(rows);
});
apiRouter.post('/data/customers', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF]), async (req: Request, res: Response) => {
    const { name, address, phone, kraPin } = req.body;
    if (!name || !address || !phone) {
        return res.status(400).json({ message: "Name, address, and phone are required."});
    }
    const [result]: [any, FieldPacket[]] = await db.execute('INSERT INTO customers (name, address, phone, kra_pin) VALUES (?, ?, ?, ?)', [name, address, phone, kraPin || null]);
    res.status(201).json({ id: result.insertId, name, address, phone, kraPin });
});
apiRouter.get('/data/branches', async (req: Request, res: Response) => {
    const [rows] = await db.query('SELECT id, name, address, phone FROM branches');
    res.json(rows);
});
apiRouter.get('/data/sales', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    let query = 'SELECT s.id, s.sale_no, s.customer_id, s.branch_id, s.created_at, s.total_amount as amount, (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items FROM sales s';
    const params = [];
    if (startDate && endDate) { query += ' WHERE s.created_at >= ? AND s.created_at < ?'; params.push(startDate as string, endDate as string); }
    query += ' ORDER BY s.created_at DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
});
apiRouter.get('/data/invoices', async (req: Request, res: Response) => {
    const [rows] = await db.query('SELECT id, invoice_no FROM invoices WHERE status = "Unpaid" ORDER BY created_at DESC');
    res.json(rows);
});

// POS
apiRouter.post('/pos/sales', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF]), async (req: Request, res: Response) => {
    const connection = await db.getConnection();
    try {
        const saleData = await createSaleFromPayload(req.body, connection);
        res.status(201).json(saleData);
    } catch (error) { res.status(500).json({ message: 'Failed to create sale' }); } 
    finally { connection.release(); }
});

// Shipping
apiRouter.get('/shipping/labels', async (req: Request, res: Response) => {
    const [rows] = await db.query('SELECT * FROM shipping_labels ORDER BY created_at DESC');
    res.json(rows);
});
apiRouter.post('/shipping/labels', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF, UserRole.WAREHOUSE_CLERK, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const labelData = { id: uuidv4(), status: 'Draft', ...req.body };
    await db.query('INSERT INTO shipping_labels SET ?', labelData);
    res.status(201).json(labelData);
});
apiRouter.patch('/shipping/labels/:id/status', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.SALES_STAFF, UserRole.WAREHOUSE_CLERK, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { id } = req.params; const { status } = req.body;
    await db.query('UPDATE shipping_labels SET status = ? WHERE id = ?', [status, id]);
    const [updated] = await db.query('SELECT * FROM shipping_labels WHERE id = ?', [id]);
    res.json((updated as any)[0]);
});

// --- Quotations & Invoices (FULLY IMPLEMENTED) ---
const VIEW_FINANCIALS_ROLES = [UserRole.SALES_STAFF, UserRole.ACCOUNTANT, UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER];
const MANAGE_FINANCIALS_ROLES = [UserRole.SALES_STAFF, UserRole.SYSTEM_ADMINISTRATOR];

apiRouter.get('/quotations', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const [rows] = await db.query(`SELECT q.id, q.quotation_no, q.customer_id, q.branch_id, q.created_at, q.valid_until, q.status, q.total_amount as amount, c.name as customerName FROM quotations q JOIN customers c ON q.customer_id = c.id ORDER BY q.created_at DESC`);
    res.json(rows);
});

apiRouter.get('/quotations/:id', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const [quoteRows] = await db.query(`
            SELECT q.*, c.name as customer_name, c.address as customer_address, c.phone as customer_phone,
                   b.name as branch_name, b.address as branch_address, b.phone as branch_phone
            FROM quotations q
            JOIN customers c ON q.customer_id = c.id
            JOIN branches b ON q.branch_id = b.id
            WHERE q.id = ?
        `, [id]) as RowDataPacket[][];

        if (quoteRows.length === 0) return res.status(404).json({ message: 'Quotation not found' });
        
        const quotation = quoteRows[0];
        const [itemRows] = await db.query(`SELECT qi.*, p.name as product_name, p.part_number FROM quotation_items qi JOIN products p ON qi.product_id = p.id WHERE qi.quotation_id = ?`, [id]) as RowDataPacket[][];
        
        const response = {
            id: quotation.id, quotation_no: quotation.quotation_no, customer_id: quotation.customer_id, branch_id: quotation.branch_id, created_at: quotation.created_at, valid_until: quotation.valid_until, status: quotation.status, amount: quotation.total_amount,
            customer: { id: quotation.customer_id, name: quotation.customer_name, address: quotation.customer_address, phone: quotation.customer_phone, kraPin: quotation.customer_kra_pin },
            branch: { id: quotation.branch_id, name: quotation.branch_name, address: quotation.branch_address, phone: quotation.branch_phone },
            items: itemRows,
        };
        res.json(response);
    } catch (error) { res.status(500).json({ message: "Server error fetching quotation details" }); }
});

apiRouter.post('/quotations', authorizeRole(MANAGE_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { customerId, branchId, items, validUntil } = req.body;
    if (!customerId || !branchId || !items || !validUntil || items.length === 0) return res.status(400).json({ message: "Missing required fields for quotation." });
    
    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
        const totalAmount = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
        
        // New quotation number generation logic
        const now = new Date();
        const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const likePattern = `QUO-${datePrefix}-%`;
        const [countResult] = await connection.query('SELECT COUNT(*) as count FROM quotations WHERE quotation_no LIKE ?', [likePattern]) as RowDataPacket[][];
        const nextSequence = String(countResult[0].count + 1).padStart(4, '0');
        const quotationNo = `QUO-${datePrefix}-${nextSequence}`;

        const [result]: [any, FieldPacket[]] = await connection.execute( 'INSERT INTO quotations (quotation_no, customer_id, branch_id, valid_until, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)', [quotationNo, customerId, branchId, validUntil, totalAmount, 'Draft'] );
        const quotationId = result.insertId;
        for (const item of items) { await connection.execute('INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [quotationId, item.productId, item.quantity, item.unitPrice]); }
        await connection.commit();
        
        const [rows] = await db.query(`SELECT q.id, q.quotation_no, q.customer_id, q.branch_id, q.created_at, q.valid_until, q.status, q.total_amount as amount, c.name as customerName FROM quotations q JOIN customers c ON q.customer_id = c.id WHERE q.id = ?`, [quotationId]);
        res.status(201).json((rows as any)[0]);
    } catch (error) { await connection.rollback(); res.status(500).json({ message: "Failed to create quotation" }); } 
    finally { connection.release(); }
});

apiRouter.patch('/quotations/:id/status', authorizeRole(MANAGE_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params; const { status } = req.body;
    try {
        await db.execute('UPDATE quotations SET status = ? WHERE id = ?', [status, id]);
        const [rows] = await db.query(`SELECT q.id, q.quotation_no, q.customer_id, q.branch_id, q.created_at, q.valid_until, q.status, q.total_amount as amount, c.name as customerName FROM quotations q JOIN customers c ON q.customer_id = c.id WHERE q.id = ?`, [id]);
        if ((rows as any).length === 0) return res.status(404).json({ message: 'Quotation not found' });
        res.json((rows as any)[0]);
    } catch (error) { res.status(500).json({ message: "Failed to update quotation status" }); }
});

apiRouter.post('/quotations/:id/convert', authorizeRole(MANAGE_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
        const [quoteRows] = await connection.query('SELECT * FROM quotations WHERE id = ?', [id]) as RowDataPacket[][];
        if (quoteRows.length === 0) throw new Error('Quotation not found.');
        const quotation = quoteRows[0];
        
        if (quotation.status !== 'Accepted') throw new Error('Only accepted quotations can be converted.');
        const [existingInvoice] = await connection.query('SELECT id FROM invoices WHERE quotation_id = ?', [id]) as RowDataPacket[][];
        if (existingInvoice.length > 0) throw new Error('Invoice already created for this quotation.');

        const [quoteItems] = await connection.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]) as RowDataPacket[][];
        const settings = await getAppSettings(connection);
        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + settings.invoiceDueDays);
        const invoiceNo = `INV-${Date.now()}`;
        
        const [invoiceResult]: [any, FieldPacket[]] = await connection.execute('INSERT INTO invoices (invoice_no, customer_id, branch_id, quotation_id, due_date, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [invoiceNo, quotation.customer_id, quotation.branch_id, id, dueDate.toISOString().split('T')[0], quotation.total_amount, 'Unpaid']);
        const invoiceId = invoiceResult.insertId;
        for (const item of quoteItems) { await connection.execute('INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [invoiceId, item.product_id, item.quantity, item.unit_price]); }
        await connection.execute('UPDATE quotations SET status = "Invoiced" WHERE id = ?', [id]);
        await connection.commit();

        const [invoiceRows] = await connection.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]) as RowDataPacket[][];
        res.status(201).json(invoiceRows[0]);
    } catch (error: any) { await connection.rollback(); res.status(500).json({ message: error.message || "Failed to convert quotation" }); } 
    finally { connection.release(); }
});

apiRouter.get('/invoices', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { status } = req.query;
    let query = `SELECT i.id, i.invoice_no, i.customer_id, i.branch_id, i.created_at, i.due_date, i.status, i.total_amount as amount, c.name as customerName FROM invoices i JOIN customers c ON i.customer_id = c.id`;
    const params = [];
    if (status && status !== 'All') { query += ' WHERE i.status = ?'; params.push(status as string); }
    query += ' ORDER BY i.created_at DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
});

apiRouter.get('/invoices/:id', authorizeRole(VIEW_FINANCIALS_ROLES), async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const [invoiceRows] = await db.query(`
            SELECT i.*, c.name as customer_name, c.address as customer_address, c.phone as customer_phone, c.kra_pin as customer_kra_pin,
                   b.name as branch_name, b.address as branch_address, b.phone as branch_phone
            FROM invoices i JOIN customers c ON i.customer_id = c.id JOIN branches b ON i.branch_id = b.id WHERE i.id = ?
        `, [id]) as RowDataPacket[][];
        if (invoiceRows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
        
        const invoice = invoiceRows[0];
        const [itemRows] = await db.query(`SELECT ii.*, p.name as product_name, p.part_number FROM invoice_items ii JOIN products p ON ii.product_id = p.id WHERE ii.invoice_id = ?`, [id]) as RowDataPacket[][];
        
        const response = {
            id: invoice.id, invoice_no: invoice.invoice_no, customer_id: invoice.customer_id, branch_id: invoice.branch_id, created_at: invoice.created_at, due_date: invoice.due_date, status: invoice.status, amount: invoice.total_amount, amount_paid: invoice.amount_paid, quotation_id: invoice.quotation_id,
            customer: { id: invoice.customer_id, name: invoice.customer_name, address: invoice.customer_address, phone: invoice.customer_phone, kraPin: invoice.customer_kra_pin },
            branch: { id: invoice.branch_id, name: invoice.branch_name, address: invoice.branch_address, phone: invoice.branch_phone },
            items: itemRows,
        };
        res.json(response);
    } catch (error) { res.status(500).json({ message: "Server error fetching invoice details" }); }
});

// Dashboard
apiRouter.get('/dashboard/stats', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as { startDate: string, endDate: string };
    const connection = await db.getConnection();
    try {
        const [sales]:[any[], FieldPacket[]] = await connection.query('SELECT SUM(total_amount) as total, COUNT(*) as count FROM sales WHERE created_at >= ? AND created_at < ?', [startDate, endDate]);
        const [customers]:[any[], FieldPacket[]] = await connection.query('SELECT COUNT(DISTINCT customer_id) as count FROM sales WHERE created_at >= ? AND created_at < ?', [startDate, endDate]);
        const [shipments]:[any[], FieldPacket[]] = await connection.query('SELECT COUNT(*) as total, SUM(CASE WHEN status="Draft" THEN 1 ELSE 0 END) as pending FROM shipping_labels WHERE created_at >= ? AND created_at < ?', [startDate, endDate]);
        const settings = await getAppSettings(connection);
        res.json({ totalRevenue: sales[0].total || 0, totalSales: sales[0].count || 0, activeCustomers: customers[0].count || 0, totalShipments: shipments[0].total || 0, pendingShipments: shipments[0].pending || 0, salesTarget: settings.salesTarget });
    } catch(error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: "Failed to load dashboard statistics." });
    } finally {
        connection.release();
    }
});
apiRouter.post('/dashboard/sales-target', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const { target } = req.body;
    if (target === undefined || typeof target !== 'number' || target < 0) {
        return res.status(400).json({ message: "A valid, non-negative target number is required." });
    }
    try {
        await db.query(
            'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
            ['sales_target', target]
        );
        res.json({ salesTarget: target });
    } catch (error) {
        console.error("Failed to update sales target:", error);
        res.status(500).json({ message: "Failed to update sales target." });
    }
});
apiRouter.get('/dashboard/sales-chart', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as { startDate: string, endDate: string };
    const [data] = await db.query(`SELECT DATE(created_at) as name, SUM(total_amount) as revenue, COUNT(*) as sales FROM sales WHERE created_at >= ? AND created_at < ? GROUP BY name ORDER BY name ASC`, [startDate, endDate]);
    res.json(data);
});

// Notifications
apiRouter.get('/notifications', async (req: Request, res: Response) => {
    const { lastCheck } = req.query;
    const serverTimestamp = new Date().toISOString();
    const settings = await getAppSettings(db);
    let newApplicationsQuery = "SELECT id, business_name as businessName, status FROM b2b_applications WHERE status = 'Pending'";
    if (lastCheck) newApplicationsQuery += ` AND submitted_at > ?`;
    const [newApps] = await db.query(newApplicationsQuery, [lastCheck as string]);
    const [lowStock] = await db.query("SELECT id, name, stock FROM products WHERE stock < ? AND stock > 0", [settings.lowStockThreshold]);
    res.json({ newApplications: newApps, lowStockProducts: lowStock, serverTimestamp: serverTimestamp });
});

// Settings
apiRouter.get('/settings', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const settings = await getAppSettings(db); res.json(settings);
});
apiRouter.patch('/settings', authorizeRole([UserRole.SYSTEM_ADMINISTRATOR, UserRole.INVENTORY_MANAGER]), async (req: Request, res: Response) => {
    const settingsToUpdate = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (const key in settingsToUpdate) {
            const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            const value = settingsToUpdate[key];
            await connection.query('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [snakeCaseKey, value]);
        }
        await connection.commit();
        res.json(await getAppSettings(connection));
    } catch (error) { await connection.rollback(); res.status(500).json({ message: "Failed to update settings" }); } 
    finally { connection.release(); }
});

// --- M-PESA PAYMENTS ---
apiRouter.post('/payments/mpesa/initiate', async (req: Request, res: Response) => {
    const { amount, phoneNumber, cart, customerId, branchId, invoiceId } = req.body;
    const checkoutRequestId = `crq_${uuidv4()}`;
    const merchantRequestId = `mrq_${uuidv4()}`;
    try {
        const transactionDetails = { cart, customerId, branchId, discount: req.body.discount, taxAmount: req.body.taxAmount, totalAmount: req.body.totalAmount };
        await db.query('INSERT INTO mpesa_transactions (checkout_request_id, merchant_request_id, amount, phone_number, invoice_id, transaction_details, status) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [checkoutRequestId, merchantRequestId, amount, phoneNumber, invoiceId || null, JSON.stringify(transactionDetails), 'Pending']);
        
        // --- SIMULATE SAFARICOM CALLBACK ---
        // In production, Safaricom calls our public callback URL. We simulate this by having the server call its own endpoint.
        const callbackPayload = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": merchantRequestId,
                    "CheckoutRequestID": checkoutRequestId,
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            { "Name": "Amount", "Value": amount },
                            { "Name": "MpesaReceiptNumber", "Value": `SIM_${Date.now()}` },
                            { "Name": "TransactionDate", "Value": new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3) },
                            { "Name": "PhoneNumber", "Value": phoneNumber }
                        ]
                    }
                }
            }
        };

        // Fire-and-forget fetch to our own callback to simulate the asynchronous nature
        fetch(`http://localhost:${port}/api/payments/mpesa/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callbackPayload)
        }).catch(err => console.error("Simulated callback fetch failed:", err));

        res.json({ checkoutRequestId });
    } catch (error) { res.status(500).json({ message: 'Failed to initiate M-Pesa payment.' }); }
});

apiRouter.get('/payments/mpesa/status/:checkoutRequestId', async (req: Request, res: Response) => {
    const { checkoutRequestId } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?', [checkoutRequestId]) as RowDataPacket[][];
        if (rows.length === 0) return res.status(404).json({ message: 'Transaction not found.' });
        const tx = rows[0];
        if (tx.status === 'Completed' && tx.sale_id) {
            const [saleDetails] = await db.query(`SELECT s.id, s.sale_no, s.created_at, s.total_amount as amount, s.tax_amount, s.payment_method, c.id as customer_id, c.name as customer_name, b.id as branch_id, b.name as branch_name, b.address as branch_address, b.phone as branch_phone FROM sales s JOIN customers c ON s.customer_id = c.id JOIN branches b ON s.branch_id = b.id WHERE s.id = ?`, [tx.sale_id]);
            const [itemDetails] = await db.query(`SELECT si.id, si.quantity, si.unit_price, p.name as product_name, p.part_number FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`, [tx.sale_id]);
            const saleResponse = (saleDetails as any)[0];
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

app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
});
