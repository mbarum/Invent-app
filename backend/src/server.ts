// FIX: Use fully qualified Express types (e.g., express.Request) to resolve conflicts with global types and ensure correct type inference.
// Fix: Changed import to directly import Request, Response, and NextFunction to avoid type conflicts.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// A simple utility to add -dev to uuid for readability
const newId = () => uuidv4().substring(0, 13) + '-dev';

// Mock in-memory storage for sales target for demonstration purposes
let mockSalesTarget = 5000000;


dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow requests from your frontend
app.use(express.json()); // Parse JSON bodies
// Serve static files from the 'uploads' directory, making them accessible via URL
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Extend Express Request type to include 'user' property from JWT payload
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

// --- JWT AUTH MIDDLEWARE ---
// FIX: Added explicit types for req, res, and next to ensure correct type inference.
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'please_set_a_real_secret_key', (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ message: 'Forbidden: Token is invalid or expired' });
        }
        req.user = user;
        next();
    });
};

// Helper function to create a SQL WHERE clause for date filtering
const createDateFilter = (columnName: string, startDate?: any, endDate?: any): { clause: string; params: string[] } => {
    // We expect `endDate` to be the day *after* the user's selection for a `<` comparison.
    if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
        return {
            clause: ` AND ${columnName} >= ? AND ${columnName} < ?`,
            params: [startDate, endDate]
        };
    }
    return { clause: '', params: [] };
};


// --- MULTER SETUP for File Uploads ---
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


// --- API ROUTES ---

// Health Check (Unprotected)
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api', (req: Request, res: Response) => {
  res.send('Masuma EA Hub Backend is running!');
});

// --- AUTH (Unprotected) ---
// FIX: Added explicit types for req and res to ensure correct type inference.
app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    
    // --- Superuser backdoor for testing ---
    if (email === 'sales@masuma.africa' && password === 'Masuma_Admin_2024!') {
        console.log('Superuser login successful for sales@masuma.africa');
        const token = jwt.sign(
            { id: 'superuser-01', email: 'sales@masuma.africa', role: 'admin' },
            process.env.JWT_SECRET || 'please_set_a_real_secret_key',
            { expiresIn: '1d' }
        );
        return res.json({ token });
    }
    // --- End of superuser backdoor ---

    try {
        const [[user]] = await db.query<RowDataPacket[]>(
            'SELECT * FROM b2b_applications WHERE contactEmail = ?',
            [email]
        );

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        if (user.status !== 'Approved') {
            return res.status(403).json({ message: 'Your account is pending approval or has been rejected.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.contactEmail },
            process.env.JWT_SECRET || 'please_set_a_real_secret_key',
            { expiresIn: '1d' }
        );
        
        res.json({ token });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

const registrationUpload = upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]);
// FIX: Added explicit types for req and res to ensure correct type inference.
app.post('/api/auth/register', registrationUpload, async (req: Request, res: Response) => {
    const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const certOfIncFile = files?.certOfInc?.[0];
    const cr12File = files?.cr12?.[0];

    if (!businessName || !contactEmail || !password || !certOfIncFile || !cr12File) {
        return res.status(400).json({ message: 'Missing required fields or document uploads.' });
    }
    
    try {
        const [[existingUser]] = await db.query<RowDataPacket[]>('SELECT id FROM b2b_applications WHERE contactEmail = ?', [contactEmail]);
        if (existingUser) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newApp = {
            id: `B2B-${newId()}`,
            businessName,
            kraPin,
            contactName,
            contactEmail,
            contactPhone,
            password: hashedPassword,
            status: 'Pending',
            submittedAt: new Date().toISOString(),
            certOfIncUrl: `/uploads/${certOfIncFile.filename}`,
            cr12Url: `/uploads/${cr12File.filename}`,
        };
        
        await db.query('INSERT INTO b2b_applications SET ?', newApp);
        
        const { password: _, ...responseData } = newApp; 
        res.status(201).json(responseData);

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Error processing registration' });
    }
});


// --- INVENTORY (Protected) ---
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/inventory/products', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [rows] = await db.query('SELECT * FROM products ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// --- B2B MANAGEMENT (Protected) ---
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/b2b/applications', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [rows] = await db.query('SELECT * FROM b2b_applications ORDER BY submittedAt DESC');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching B2B applications' });
    }
});

// FIX: Added explicit types for req and res to ensure correct type inference.
app.patch('/api/b2b/applications/:id/status', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db.query('UPDATE b2b_applications SET status = ? WHERE id = ?', [status, id]);
        const [[updatedApp]] = await db.query<RowDataPacket[]>('SELECT * FROM b2b_applications WHERE id = ?', [id]);
        res.json(updatedApp);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating application status' });
    }
});


// --- SHIPPING (Protected) ---
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/shipping/labels', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = createDateFilter('created_at', startDate, endDate);
        const query = `SELECT * FROM shipping_labels WHERE 1=1 ${dateFilter.clause} ORDER BY created_at DESC`;
        const [rows] = await db.query(query, dateFilter.params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching shipping labels' });
    }
});

// FIX: Added explicit types for req and res to ensure correct type inference.
app.post('/api/shipping/labels', authenticateToken, async (req: Request, res: Response) => {
    try {
        const newLabel = {
            id: `LBL-${newId()}`,
            ...req.body,
            status: 'Draft',
            created_at: new Date().toISOString(),
        };
        await db.query('INSERT INTO shipping_labels SET ?', newLabel);
        res.status(201).json(newLabel);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating shipping label' });
    }
});

// FIX: Added explicit types for req and res to ensure correct type inference.
app.patch('/api/shipping/labels/:id/status', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db.query('UPDATE shipping_labels SET status = ? WHERE id = ?', [status, id]);
        const [[updatedLabel]] = await db.query<RowDataPacket[]>('SELECT * FROM shipping_labels WHERE id = ?', [id]);
        res.json(updatedLabel);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating shipping label status' });
    }
});

// --- GENERAL DATA (Protected) ---
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/data/sales', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = createDateFilter('created_at', startDate, endDate);
        const query = `SELECT * FROM sales WHERE 1=1 ${dateFilter.clause} ORDER BY created_at DESC`;
        const [rows] = await db.query(query, dateFilter.params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sales' });
    }
});
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/data/invoices', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [rows] = await db.query('SELECT * FROM invoices ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching invoices' });
    }
});
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/data/branches', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [rows] = await db.query('SELECT * FROM branches');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching branches' });
    }
});
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/data/customers', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [rows] = await db.query('SELECT * FROM customers');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching customers' });
    }
});

// --- NOTIFICATIONS (Protected) ---
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/notifications', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { lastCheck } = req.query;
        const LOW_STOCK_THRESHOLD = 10;

        // 1. Get new B2B applications
        let newAppsQuery = 'SELECT * FROM b2b_applications WHERE status = ?';
        const newAppsParams: any[] = ['Pending'];
        if (lastCheck && typeof lastCheck === 'string') {
            newAppsQuery += ' AND submittedAt > ?';
            newAppsParams.push(lastCheck);
        }
        newAppsQuery += ' ORDER BY submittedAt DESC';
        const [newApplications] = await db.query<RowDataPacket[]>(newAppsQuery, newAppsParams);

        // 2. Get low stock products
        const [lowStockProducts] = await db.query<RowDataPacket[]>(
            'SELECT * FROM products WHERE stock < ? ORDER BY stock ASC',
            [LOW_STOCK_THRESHOLD]
        );

        res.json({
            newApplications,
            lowStockProducts,
            serverTimestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
});


// --- DASHBOARD (Protected) ---
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/dashboard/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = createDateFilter('created_at', startDate, endDate);
        
        const [[revenueData]] = await db.query(`SELECT SUM(amount) as totalRevenue FROM sales WHERE 1=1 ${dateFilter.clause}`, dateFilter.params) as RowDataPacket[][];
        const [[salesData]] = await db.query(`SELECT COUNT(*) as totalSales FROM sales WHERE 1=1 ${dateFilter.clause}`, dateFilter.params) as RowDataPacket[][];
        const [[customerData]] = await db.query(`SELECT COUNT(DISTINCT customer_id) as activeCustomers FROM sales WHERE 1=1 ${dateFilter.clause}`, dateFilter.params) as RowDataPacket[][];
        const [[shipmentData]] = await db.query(`SELECT COUNT(*) as totalShipments FROM shipping_labels WHERE status != "Draft" ${dateFilter.clause}`, dateFilter.params) as RowDataPacket[][];
        const [[pendingShipmentData]] = await db.query(`SELECT COUNT(*) as pendingShipments FROM shipping_labels WHERE status = "Draft" ${dateFilter.clause}`, dateFilter.params) as RowDataPacket[][];
        
        res.json({
            totalRevenue: revenueData.totalRevenue || 0,
            revenueChange: 12.5, // Mock data
            totalSales: salesData.totalSales || 0,
            salesChange: 8.2, // Mock data
            activeCustomers: customerData.activeCustomers || 0,
            customersChange: 5, // Mock data
            totalShipments: shipmentData.totalShipments || 0,
            pendingShipments: pendingShipmentData.pendingShipments || 0,
            salesTarget: mockSalesTarget,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
});

// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('/api/dashboard/sales-chart', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = createDateFilter('created_at', startDate, endDate);

        const query = `
            SELECT 
                DATE(created_at) as name, 
                SUM(amount) as revenue, 
                COUNT(*) as sales 
            FROM sales 
            WHERE 1=1 ${dateFilter.clause} 
            GROUP BY name 
            ORDER BY name ASC`;
        
        const [rows] = await db.query(query, dateFilter.params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ message: 'Error fetching chart data' });
    }
});

// FIX: Added explicit types for req and res to ensure correct type inference.
app.post('/api/dashboard/sales-target', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { target } = req.body;
        if (typeof target !== 'number' || target < 0) {
            return res.status(400).json({ message: 'Invalid target amount.' });
        }
        // In a real app, this would update a database.
        mockSalesTarget = target;
        res.json({ salesTarget: mockSalesTarget });
    } catch (error) {
        console.error('Error updating sales target:', error);
        res.status(500).json({ message: 'Failed to update sales target' });
    }
});

// --- SERVE FRONTEND ---
// This must be after all API routes.
// It serves the static assets from the project root.
const projectRoot = path.resolve(__dirname, '..', '..');
app.use(express.static(projectRoot, {
    // FIX: Added explicit type for res to ensure correct type inference.
    setHeaders: (res: Response, filePath) => {
        // The execution environment for this project transpiles TSX on the fly.
        // We need to serve .ts/.tsx files with a JavaScript MIME type
        // for the browser to be able to import and execute them as modules.
        if (path.extname(filePath) === '.ts' || path.extname(filePath) === '.tsx') {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// For any GET request that doesn't match an API route or a static file,
// send the index.html file. This is the SPA fallback.
// FIX: Added explicit types for req and res to ensure correct type inference.
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(projectRoot, 'index.html'));
});


// Start Server
app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});
