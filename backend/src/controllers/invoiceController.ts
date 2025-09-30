// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import db from '../db';
import { InvoiceStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getInvoices = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
    const { status } = req.query;
    try {
        const query = db('invoices')
            .select('invoices.*', 'customers.name as customerName')
            .leftJoin('customers', 'invoices.customerId', 'customers.id')
            .orderBy('invoices.createdAt', 'desc');

        if (status && Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
            query.where('invoices.status', status as string);
        }

        const invoices = await query;
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(invoices);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getInvoiceDetails = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    try {
        const invoice = await db('invoices').where('invoices.id', id).first();
        if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

        const items = await db('invoice_items')
            .select('invoice_items.*', 'products.partNumber', 'products.name as productName')
            .leftJoin('products', 'invoice_items.productId', 'products.id')
            .where('invoice_items.invoiceId', id);

        const customer = await db('customers').where({ id: invoice.customerId }).first();
        const branch = await db('branches').where({ id: invoice.branchId }).first();

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ ...invoice, items, customer, branch });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getUnpaidSnippets = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const snippets = await db('invoices')
            .select('id', 'invoiceNo')
            .where('status', InvoiceStatus.UNPAID)
            .orderBy('createdAt', 'desc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(snippets);
    } catch (error) {
        next(error);
    }
};

// Use the explicitly typed handlers with the router
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), getInvoices);
router.get('/unpaid-snippets', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), getUnpaidSnippets);
router.get('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), getInvoiceDetails);

export default router;