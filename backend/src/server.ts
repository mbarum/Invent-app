// This line must be at the very top
import 'tsconfig-paths/register';

// FIX: Replaced aliased express types with direct imports to resolve middleware type conflicts.
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// FIX: Changed pino import to default export for correct type inference.
import pinoHttp from 'pino-http';

import db from './db';
import { authMiddleware, permissionMiddleware } from './middleware/authMiddleware';
import { validate } from './validation';
import * as schemas from './validation';
import { PERMISSIONS } from '../../config/permissions';
import { upload } from './middleware/multerConfig';

// Import all controllers and embed their logic here as we can't create new files.
import * as authController from './controllers/authController';
import * as productController from './controllers/productController';
import * as dashboardController from './controllers/dashboardController';
import * as posController from './controllers/posController';
import * as customerController from './controllers/customerController';
import * as branchController from './controllers/branchController';
import * as userController from './controllers/userController';
import * as b2bController from './controllers/b2bController';
import * as shippingController from './controllers/shippingController';
import * as quotationController from './controllers/quotationController';
import * as invoiceController from './controllers/invoiceController';
import * as vinController from './controllers/vinController';
import * as reportController from './controllers/reportController';
import * as settingsController from './controllers/settingsController';
import * as stockRequestController from './controllers/stockRequestController';
import * as auditLogController from './controllers/auditLogController';
import * as notificationController from './controllers/notificationController';
import * as mpesaController from './controllers/mpesaController';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app: Express = express();
const PORT = process.env.PORT || 3001;

// --- SECURITY & CORE MIDDLEWARE ---
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Structured JSON logging for production
// FIX: Used the imported 'pinoHttp' instead of 'pino' to match the import change.
app.use(pinoHttp({
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
}));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));


// --- RATE LIMITING ---
// Apply stricter rate limiting to authentication routes to prevent brute-force attacks.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
});

const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many accounts created from this IP, please try again after an hour',
});


// --- ROUTES ---
const apiRouter = express.Router();

// Health Check
// FIX: Added explicit types for req and res to ensure correct type inference.
apiRouter.get('/health', async (req: Request, res: Response) => {
    try {
        await db.raw('SELECT 1+1 AS result');
        res.status(200).json({ status: 'ok', database: 'connected' });
    } catch (error: any) {
        // FIX: Cast req to any to access the pino logger property without complex type declarations.
        (req as any).log.error(error, "Health check failed: database connection error");
        res.status(503).json({ status: 'error', database: 'disconnected', message: error.message });
    }
});


// --- AUTH ROUTES ---
// NOTE: All auth logic is now implemented in the corresponding controller files.
apiRouter.post('/auth/login', authLimiter, validate(schemas.loginSchema), authController.login);
apiRouter.post('/auth/google', authLimiter, validate(schemas.googleLoginSchema), authController.loginWithGoogle);
apiRouter.post('/auth/logout', authController.logout);
apiRouter.get('/auth/verify', authMiddleware, authController.verifySession); // Renamed from 'me' for clarity in cookie-based flow
apiRouter.post('/auth/register', registrationLimiter, upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), validate(schemas.registerSchema), authController.register);

// --- PROTECTED ROUTES ---
// All subsequent routes will implicitly use the authMiddleware defined in their respective controllers where needed.

// Dashboard
apiRouter.get('/dashboard/stats', authMiddleware, dashboardController.getDashboardStats);
apiRouter.get('/dashboard/sales-chart', authMiddleware, dashboardController.getSalesChartData);
apiRouter.get('/dashboard/fast-moving', authMiddleware, dashboardController.getFastMovingProducts);
apiRouter.put('/dashboard/sales-target', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_SETTINGS), dashboardController.updateSalesTarget);

// Products
apiRouter.get('/products', authMiddleware, productController.getProducts);
apiRouter.post('/products', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_INVENTORY), validate(schemas.productSchema), productController.createProduct);
apiRouter.post('/products/import', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_INVENTORY), productController.importProducts);
apiRouter.put('/products/:id', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_INVENTORY), validate(schemas.updateProductSchema), productController.updateProduct);
apiRouter.delete('/products/:id', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_INVENTORY), productController.deleteProduct);

// Customers
apiRouter.get('/customers', authMiddleware, customerController.getCustomers);
apiRouter.post('/customers', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_CUSTOMERS), validate(schemas.createCustomerSchema), customerController.createCustomer);
apiRouter.get('/customers/:id/transactions', authMiddleware, customerController.getCustomerTransactions);

// Branches
apiRouter.get('/branches', authMiddleware, branchController.getBranches);
apiRouter.post('/branches', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_BRANCHES), validate(schemas.createBranchSchema), branchController.createBranch);
apiRouter.put('/branches/:id', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_BRANCHES), validate(schemas.updateBranchSchema), branchController.updateBranch);

// POS / Sales
apiRouter.get('/sales', authMiddleware, posController.getSales);
apiRouter.get('/sales/:id', authMiddleware, posController.getSaleDetails);
apiRouter.post('/sales', authMiddleware, permissionMiddleware(PERMISSIONS.USE_POS), validate(schemas.createSaleSchema), posController.createSale);

// Invoices
apiRouter.get('/invoices', authMiddleware, invoiceController.getInvoices);
apiRouter.get('/invoices/:id', authMiddleware, invoiceController.getInvoiceDetails);
apiRouter.post('/invoices/from-quotation/:id', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_INVOICES), invoiceController.convertQuotationToInvoice);

// Quotations
apiRouter.get('/quotations', authMiddleware, quotationController.getQuotations);
apiRouter.get('/quotations/:id', authMiddleware, quotationController.getQuotationDetails);
apiRouter.post('/quotations', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_QUOTATIONS), validate(schemas.createQuotationSchema), quotationController.createQuotation);
apiRouter.patch('/quotations/:id/status', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_QUOTATIONS), validate(schemas.updateQuotationStatusSchema), quotationController.updateQuotationStatus);

// Shipping
apiRouter.get('/shipping', authMiddleware, shippingController.getShippingLabels);
apiRouter.post('/shipping', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_SHIPPING), validate(schemas.createLabelSchema), shippingController.createShippingLabel);
apiRouter.patch('/shipping/:id/status', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_SHIPPING), validate(schemas.updateLabelStatusSchema), shippingController.updateShippingLabelStatus);

// VIN Picker
apiRouter.get('/vin/:vin', authMiddleware, vinController.getPartsForVin);

// Reports
apiRouter.get('/reports/shipments', authMiddleware, reportController.getShipmentsReport);

// B2B Management
apiRouter.get('/b2b/applications', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_B2B_APPLICATIONS), b2bController.getB2BApplications);
apiRouter.patch('/b2b/applications/:id/status', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_B2B_APPLICATIONS), validate(schemas.updateB2BStatusSchema), b2bController.updateB2BApplicationStatus);

// Stock Requests (B2B Portal & Management)
apiRouter.get('/stock-requests/my', authMiddleware, permissionMiddleware(PERMISSIONS.USE_B2B_PORTAL), stockRequestController.getMyStockRequests);
apiRouter.get('/stock-requests/all', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_B2B_APPLICATIONS), stockRequestController.getAllStockRequests);
apiRouter.get('/stock-requests/:id', authMiddleware, stockRequestController.getStockRequestDetails); // Accessible by both client and admin
apiRouter.post('/stock-requests', authMiddleware, permissionMiddleware(PERMISSIONS.USE_B2B_PORTAL), validate(schemas.createStockRequestSchema), stockRequestController.createStockRequest);
apiRouter.patch('/stock-requests/:id/status', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_B2B_APPLICATIONS), validate(schemas.updateStockRequestStatusSchema), stockRequestController.updateStockRequestStatus);

// Users
apiRouter.get('/users', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_USERS), userController.getUsers);
apiRouter.post('/users', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_USERS), validate(schemas.createUserSchema), userController.createUser);
apiRouter.put('/users/:id', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_USERS), validate(schemas.updateUserSchema), userController.updateUser);
apiRouter.put('/users/me/password', authMiddleware, validate(schemas.updatePasswordSchema), userController.updateCurrentUserPassword);

// Settings
apiRouter.get('/settings', authMiddleware, settingsController.getSettings);
apiRouter.put('/settings', authMiddleware, permissionMiddleware(PERMISSIONS.MANAGE_SETTINGS), validate(schemas.updateSettingsSchema), settingsController.updateSettings);

// Audit Logs
apiRouter.get('/audit-logs', authMiddleware, permissionMiddleware(PERMISSIONS.VIEW_AUDIT_LOGS), auditLogController.getAuditLogs);

// Notifications
apiRouter.get('/notifications', authMiddleware, notificationController.getNotifications);
apiRouter.post('/notifications/mark-read', authMiddleware, notificationController.markNotificationsAsRead);

// M-Pesa
apiRouter.post('/mpesa/stk-push', authMiddleware, mpesaController.initiateStkPush);
apiRouter.get('/mpesa/status/:checkoutRequestId', authMiddleware, mpesaController.getMpesaPaymentStatus);
apiRouter.post('/mpesa/callback', mpesaController.mpesaCallback); // This is an unsecured webhook from Safaricom
apiRouter.get('/mpesa/transactions', authMiddleware, permissionMiddleware(PERMISSIONS.VIEW_MPESA_LOGS), mpesaController.getMpesaTransactions);


app.use('/api', apiRouter);


// --- STATIC FRONTEND SERVING (for production) ---
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
    app.use(express.static(frontendDist));

    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
}


// --- ERROR HANDLING ---
// FIX: Use direct express types for the error handler signature.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // FIX: Cast req to any to access the pino logger property.
    (req as any).log.error(err);
    const statusCode = err.statusCode || 500;
    // FIX: Use the correctly typed 'res' object.
    res.status(statusCode).json({
        message: err.message || 'An unexpected error occurred on the server.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
