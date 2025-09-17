

// This line must be at the very top
import 'tsconfig-paths/register';

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import KnexSessionStore from 'connect-session-knex';
import path from 'path';
import dotenv from 'dotenv';
import db from './db';

// Load environment variables from .env file in the backend directory
dotenv.config();

// Import routers from controller files
import authRoutes from './controllers/authController';
import productRoutes from './controllers/productController';
import b2bRoutes from './controllers/b2bController';
import userRoutes from './controllers/userController';
import dataRoutes from './controllers/dataController';
import posRoutes from './controllers/posController';
import shippingRoutes from './controllers/shippingController';
import quotationRoutes from './controllers/quotationController';
import invoiceRoutes from './controllers/invoiceController';
import reportRoutes from './controllers/reportController';
import settingsRoutes from './controllers/settingsController';
import mpesaRoutes from './controllers/mpesaController';
import stockRequestRoutes from './controllers/stockRequestController';
import auditRoutes from './controllers/auditController';
import notificationRoutes from './controllers/notificationController';
// FIX: Added AI-powered VIN search controller
import vinSearchRoutes from './controllers/vinSearchController';


const app: Express = express();
const PORT = process.env.PORT || 3001;

// --- Security: Ensure critical environment variables are set ---
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    console.error('FATAL ERROR: SESSION_SECRET is not defined in environment variables.');
    process.exit(1); // Exit if the session secret is not set, as it's a critical security risk.
}


// --- MIDDLEWARE ---

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session middleware
// FIX: Use type assertion to handle CommonJS/ESM interop issue with connect-session-knex.
const KnexStore = (KnexSessionStore as any)(session);
const store = new KnexStore({ knex: db });

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
// FIX: Added AI-powered VIN search route
app.use('/api/vin-search', vinSearchRoutes);


// --- SERVE FRONTEND IN PRODUCTION ---
// This must be after all API routes
if (process.env.NODE_ENV === 'production') {
    const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');

    // Serve static files from the React app
    app.use(express.static(frontendDistPath));

    // The "catchall" handler: for any request that doesn't
    // match one above, send back React's index.html file.
    // FIX: Removed explicit types for req and res to allow Express to infer them correctly, resolving overload errors.
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}


// --- ERROR HANDLING ---
interface AppError extends Error {
    statusCode?: number;
}

// FIX: Removed explicit types for req, res, and next to allow for correct type inference.
app.use((err: AppError, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        message: err.message || 'An unexpected error occurred.',
    });
});


// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});