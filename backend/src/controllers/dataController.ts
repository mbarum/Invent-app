// FIX: Added Request, Response, and NextFunction to imports for explicit typing.
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import db from '../db';
import { isAuthenticated } from '../middleware/authMiddleware';
import { validate } from '../validation';
import { createBranchSchema, updateBranchSchema, createCustomerSchema } from '../validation';
import { auditLog } from '../services/auditService';
import { hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// --- Branches ---
// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getBranches: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branches = await db('branches').select('*');
        res.status(200).json(branches);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const createBranch: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [newBranch] = await db('branches').insert(req.body).returning('*');
        await auditLog(req.user!.id, 'BRANCH_CREATE', { branchId: newBranch.id, name: newBranch.name });
        res.status(201).json(newBranch);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const updateBranch: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [updatedBranch] = await db('branches').where({ id: req.params.id }).update(req.body).returning('*');
        if (!updatedBranch) return res.status(404).json({ message: 'Branch not found.' });
        await auditLog(req.user!.id, 'BRANCH_UPDATE', { branchId: updatedBranch.id, changes: req.body });
        res.status(200).json(updatedBranch);
    } catch (error) {
        next(error);
    }
};

// --- Customers ---
// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getCustomers: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, searchTerm, spendingFilter, recencyFilter, sortKey = 'totalSpending', sortDirection = 'descending' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        const query = db('customers')
            .select('customers.*')
            .leftJoin('sales', 'customers.id', 'sales.customerId')
            .groupBy('customers.id')
            .count('sales.id as totalOrders')
            .sum('sales.totalAmount as totalSpending')
            .max('sales.createdAt as lastPurchaseDate');

        if (searchTerm) {
            query.where(builder => builder.where('customers.name', 'like', `%${searchTerm}%`).orWhere('customers.phone', 'like', `%${searchTerm}%`));
        }
        
        // Apply sorting
        if (['name', 'totalOrders', 'totalSpending', 'lastPurchaseDate'].includes(sortKey as string)) {
            query.orderBy(sortKey as string, sortDirection === 'ascending' ? 'asc' : 'desc');
        }

        const totalQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
        const dataQuery = query.limit(Number(limit)).offset(offset);
        
        const [totalResult, customers] = await Promise.all([totalQuery, dataQuery]);
        
        res.status(200).json({ customers, total: totalResult ? Number((totalResult as any).total) : 0 });

    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const createCustomer: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [newCustomer] = await db('customers').insert(req.body).returning('*');
        await auditLog(req.user!.id, 'CUSTOMER_CREATE', { customerId: newCustomer.id, name: newCustomer.name });
        res.status(201).json(newCustomer);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getCustomerTransactions: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { customerId } = req.params;
    try {
        const sales = await db('sales').where({ customerId }).orderBy('createdAt', 'desc');
        const invoices = await db('invoices').where({ customerId }).orderBy('createdAt', 'desc');
        const quotations = await db('quotations').where({ customerId }).orderBy('createdAt', 'desc');

        res.status(200).json({ sales, invoices, quotations });
    } catch (error) {
        next(error);
    }
};

// --- Routes ---
router.get('/branches', isAuthenticated, getBranches);
router.post('/branches', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_BRANCHES), validate(createBranchSchema), createBranch);
router.put('/branches/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_BRANCHES), validate(updateBranchSchema), updateBranch);

router.get('/customers', isAuthenticated, hasPermission(PERMISSIONS.VIEW_CUSTOMERS), getCustomers);
router.post('/customers', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_CUSTOMERS), validate(createCustomerSchema), createCustomer);
router.get('/customers/:customerId/transactions', isAuthenticated, hasPermission(PERMISSIONS.VIEW_CUSTOMERS), getCustomerTransactions);

export default router;