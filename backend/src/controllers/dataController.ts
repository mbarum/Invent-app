// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import db from '../db';
import { isAuthenticated } from '../middleware/authMiddleware';
import { validate } from '../validation';
import { createBranchSchema, updateBranchSchema, createCustomerSchema, updateCustomerSchema } from '../validation';
import { auditLog } from '../services/auditService';
import { hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';


const router = Router();

// --- Branches ---
// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branches = await db('branches').select('*');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(branches);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // FIX: Correctly access req.body by using the full express.Request type.
        const [branchId] = await db('branches').insert(req.body);
        const newBranch = await db('branches').where({ id: branchId }).first();
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'BRANCH_CREATE', { branchId: newBranch.id, name: newBranch.name });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(newBranch);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // FIX: Correctly access req.params and req.body by using the full express.Request type.
        const count = await db('branches').where({ id: req.params.id }).update(req.body);
        if (count === 0) return res.status(404).json({ message: 'Branch not found.' });
        const updatedBranch = await db('branches').where({ id: req.params.id }).first();
        // FIX: Correctly access req.user and req.body by using the full express.Request type.
        await auditLog(req.user!.id, 'BRANCH_UPDATE', { branchId: updatedBranch.id, changes: req.body });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedBranch);
    } catch (error) {
        next(error);
    }
};

// --- Customers ---
// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
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

        const totalQuery = db.from(query.as('subQuery')).count('* as total').first();
        const dataQuery = query.limit(Number(limit)).offset(offset);
        
        const [totalResult, customers] = await Promise.all([totalQuery, dataQuery]);
        
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ customers, total: totalResult ? Number((totalResult as any).total) : 0 });

    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // FIX: Correctly access req.body by using the full express.Request type.
        const [customerId] = await db('customers').insert(req.body);
        const newCustomer = await db('customers').where({ id: customerId }).first();
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'CUSTOMER_CREATE', { customerId: newCustomer.id, name: newCustomer.name });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(newCustomer);
    } catch (error) {
        next(error);
    }
};

const updateCustomer: (req: Request, res: Response, next: NextFunction) => Promise<void> = async (req, res, next) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    try {
        // FIX: Correctly access req.body by using the full express.Request type.
        const count = await db('customers').where({ id }).update(req.body);
        if (count === 0) return res.status(404).json({ message: 'Customer not found.' });

        const updatedCustomer = await db('customers').where({ id }).first();
        // FIX: Correctly access req.user and req.body by using the full express.Request type.
        await auditLog(req.user!.id, 'CUSTOMER_UPDATE', { customerId: updatedCustomer.id, changes: req.body });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedCustomer);
    } catch (error) {
        next(error);
    }
};


// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getCustomerTransactions = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { customerId } = req.params;
    try {
        const sales = await db('sales').where({ customerId }).orderBy('createdAt', 'desc');
        const invoices = await db('invoices').where({ customerId }).orderBy('createdAt', 'desc');
        const quotations = await db('quotations').where({ customerId }).orderBy('createdAt', 'desc');

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ sales, invoices, quotations });
    } catch (error) {
        next(error);
    }
};

// --- Routes ---
// Use the explicitly typed handlers with the router
router.get('/branches', isAuthenticated, getBranches);
router.post('/branches', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_BRANCHES), validate(createBranchSchema), createBranch);
router.put('/branches/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_BRANCHES), validate(updateBranchSchema), updateBranch);

router.get('/customers', isAuthenticated, hasPermission(PERMISSIONS.VIEW_CUSTOMERS), getCustomers);
router.post('/customers', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_CUSTOMERS), validate(createCustomerSchema), createCustomer);
router.put('/customers/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_CUSTOMERS), validate(updateCustomerSchema), updateCustomer);
router.get('/customers/:customerId/transactions', isAuthenticated, hasPermission(PERMISSIONS.VIEW_CUSTOMERS), getCustomerTransactions);

export default router;