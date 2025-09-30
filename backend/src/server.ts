// This line must be at the very top
import 'tsconfig-paths/register';

// FIX: Add express-session import to augment Request type for session property. Moved to top to ensure it runs before express is imported.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts across the application.
import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import KnexSessionStore from 'connect-session-knex';
import path from 'path';
import dotenv from 'dotenv';
import db from './db';
// FIX: Import process to handle potential missing Node.js global types.
import process from 'process';


// Load environment variables from .env file in the backend directory
dotenv.config();

// Import routers from controller files
import authRoutes from './controllers/authController';
import productRoutes from './controllers/productController';
import b2bRoutes from './controllers/b2bController';
import userRoutes from './controllers/userController';
import dataRoutes from './controllers/dataController';
// FIX: Corrected import for posController. The controller was missing a default export, which is now added.
import posRoutes from './controllers/posController';
import shippingRoutes from './controllers/shippingController';
import quotationRoutes from './controllers/quotationController';
import invoiceRoutes from './controllers/invoiceController';
import reportRoutes from './controllers/reportController';
import settingsRoutes from './controllers/settingsController';
// FIX: Corrected import for mpesaController. The controller was missing a default export, which is now added.
import mpesaRoutes from './controllers/mpesaController';
import stockRequestRoutes from './controllers/stockRequestController';
import auditRoutes from './controllers/auditController';
import notificationRoutes from './controllers/notificationController';
import vinSearchRoutes from './controllers/vinSearchController';


// FIX: Use the default import to create the app instance.
const app = express();
const PORT = process.env.PORT || 3001;

// --- Security: Ensure critical environment variables are set ---
const SESSION_SECRET = process.env.SESSION_SECRET;
const BACKEND_URL = process.env.BACKEND_URL;
if (!SESSION_SECRET) {
    console.error('FATAL ERROR: SESSION_SECRET is not defined in environment variables.');
    process.exit(1); // Exit if the session secret is not set, as it's a critical security risk.
}
// FIX: Added a check for BACKEND_URL, which is critical for M-Pesa callbacks.
if (!BACKEND_URL) {
    console.error('FATAL ERROR: BACKEND_URL is not defined in environment variables. (e.g., https://yourdomain.com)');
    process.exit(1);
}


// --- MIDDLEWARE ---

// Trust the first proxy in front of the app. This is crucial for secure cookies
// in production environments (like CloudPanel, Nginx, etc.) where a reverse proxy
// terminates the SSL connection.
app.set('trust proxy', 1);

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

// FIX: No overload matches this call - error fixed by correcting express type imports.
app.use(express.json({ limit: '10mb' }));
// FIX: No overload matches this call - error fixed by correcting express type imports.
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// FIX: No overload matches this call - error fixed by correcting express type imports.
app.use(cookieParser());

// Session middleware
// Use type assertion to handle CommonJS/ESM interop issue with connect-session-knex.
const KnexStore = (KnexSessionStore as any)(session);
const store = new KnexStore({ knex: db });

// FIX: No overload matches this call - error fixed by correcting express type imports.
app.use(session({
    secret: SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // Lax is generally safer
    }
}));


// Serve static files (like B2B application documents)
// FIX: No overload matches this call - error fixed by correcting express type imports.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));


// --- API ROUTES ---
// Prefix all API routes with /api
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/b2b', b2bRoutes);
app.use('/api/users', userRoutes);
app.use('/api', dataRoutes); // for /branches, /customers etc.
app.use('/api/sales', posRoutes);
app.use('/api/shipping-labels', shippingRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/stock-requests', stockRequestRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vin-search', vinSearchRoutes);


// --- SERVE FRONTEND IN PRODUCTION ---
// This must be after all API routes
if (process.env.NODE_ENV === 'production') {
    const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');

    // Serve static files from the React app
    app.use(express.static(frontendDistPath));

    // The "catchall" handler: for any request that doesn't
    // match one above, send back React's index.html file.
    // FIX: Use specific Request and Response types from the default express import to resolve type errors.
    const serveFrontend = (req: Request, res: Response) => {
        // FIX: Property 'sendFile' does not exist - error fixed by using correct Response type.
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    };
    // FIX: No overload matches this call - error fixed by correcting express type imports.
    app.get('*', serveFrontend);
}


// --- ERROR HANDLING ---
interface AppError extends Error {
    statusCode?: number;
}

// FIX: Use specific types from the default express import for the error handler to resolve type errors.
const errorHandler: ErrorRequestHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    // FIX: Property 'status' does not exist - error fixed by using correct Response type.
    res.status(statusCode).json({
        message: err.message || 'An unexpected error occurred.',
    });
};
// FIX: No overload matches this call - error fixed by correcting express type imports.
app.use(errorHandler);


// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});