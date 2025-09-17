



import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { InvoiceStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getInvoices = async (req: Request, res: Response, next: NextFunction) => {
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
        res.status(200).json(invoices);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getInvoiceDetails = async (req: Request, res: Response, next: NextFunction) => {
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

        res.status(200).json({ ...invoice, items, customer, branch });
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getUnpaidSnippets = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const snippets = await db('invoices')
            .select('id', 'invoiceNo')
            .where('status', InvoiceStatus.UNPAID)
            .orderBy('createdAt', 'desc');
        res.status(200).json(snippets);
    } catch (error) {
        next(error);
    }
};

router.get('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), getInvoices);
router.get('/unpaid-snippets', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), getUnpaidSnippets);
router.get('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), getInvoiceDetails);

export default router;