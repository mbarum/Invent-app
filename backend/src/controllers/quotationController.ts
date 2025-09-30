// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import db from '../db';
import { QuotationStatus, InvoiceStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createQuotationSchema, updateQuotationStatusSchema } from '../validation';
import { auditLog } from '../services/auditService';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createQuotation = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { customerId, branchId, items, validUntil, subtotal, discountAmount, taxAmount, totalAmount } = req.body;
    try {
        const newQuotation = await db.transaction(async (trx) => {
            const [quotationId] = await trx('quotations').insert({
                quotationNo: `QUO-${Date.now()}`,
                customerId,
                branchId,
                validUntil,
                subtotal,
                discountAmount,
                taxAmount,
                totalAmount,
                status: QuotationStatus.DRAFT
            });

            const quotation = await trx('quotations').where({ id: quotationId }).first();

            const quotationItems = items.map((item: any) => ({
                quotationId: quotation.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            }));

            await trx('quotation_items').insert(quotationItems);
            return quotation;
        });
        
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'QUOTATION_CREATE', { quotationId: newQuotation.id });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(newQuotation);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getQuotations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const quotations = await db('quotations')
            .select('quotations.*', 'customers.name as customerName')
            .leftJoin('customers', 'quotations.customerId', 'customers.id')
            .orderBy('quotations.createdAt', 'desc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(quotations);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getQuotationDetails = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    try {
        const quotation = await db('quotations').where('quotations.id', id).first();
        if (!quotation) return res.status(404).json({ message: 'Quotation not found.' });

        const items = await db('quotation_items')
            .select('quotation_items.*', 'products.partNumber', 'products.name as productName')
            .leftJoin('products', 'quotation_items.productId', 'products.id')
            .where({ quotationId: id });
            
        const customer = await db('customers').where({ id: quotation.customerId }).first();
        const branch = await db('branches').where({ id: quotation.branchId }).first();

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ ...quotation, items, customer, branch });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { status } = req.body;
    try {
        const count = await db('quotations').where({ id }).update({ status });
        if (count === 0) return res.status(404).json({ message: 'Quotation not found.' });
        const updatedQuotation = await db('quotations').where({ id }).first();
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'QUOTATION_STATUS_UPDATE', { quotationId: id, newStatus: status });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedQuotation);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const convertToInvoice = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    const settings = await db('app_settings').select('*');
    const invoiceDueDays = settings.find(s => s.settingKey === 'invoiceDueDays')?.settingValue || 30;

    try {
        const newInvoice = await db.transaction(async (trx) => {
            const quotation = await trx('quotations').where({ id }).first();
            if (!quotation) throw new Error('Quotation not found.');
            if (quotation.status !== QuotationStatus.ACCEPTED) throw new Error('Only accepted quotations can be converted.');

            const items = await trx('quotation_items').where({ quotationId: id });
            
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + Number(invoiceDueDays));

            const [invoiceId] = await trx('invoices').insert({
                invoiceNo: `INV-${Date.now()}`,
                customerId: quotation.customerId,
                branchId: quotation.branchId,
                quotationId: quotation.id,
                dueDate: dueDate.toISOString().split('T')[0],
                totalAmount: quotation.totalAmount,
                amountPaid: 0,
                status: InvoiceStatus.UNPAID
            });
            
            const invoice = await trx('invoices').where({ id: invoiceId }).first();

            const invoiceItems = items.map(item => ({
                invoiceId: invoice.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            }));
            await trx('invoice_items').insert(invoiceItems);
            
            await trx('quotations').where({ id }).update({ status: QuotationStatus.INVOICED });

            return invoice;
        });

        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'QUOTATION_CONVERT_INVOICE', { quotationId: id, invoiceId: newInvoice.id });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(newInvoice);

    } catch (error) {
        next(error);
    }
};

const updateQuotation: (req: Request, res: Response, next: NextFunction) => Promise<void> = async (req, res, next) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { customerId, branchId, items, validUntil, subtotal, discountAmount, taxAmount, totalAmount } = req.body;

    try {
        const updatedQuotation = await db.transaction(async (trx) => {
            const count = await trx('quotations').where({ id }).update({
                customerId,
                branchId,
                validUntil,
                subtotal,
                discountAmount,
                taxAmount,
                totalAmount,
            });

            if (count === 0) {
                const error: any = new Error('Quotation not found.');
                error.statusCode = 404;
                throw error;
            }

            await trx('quotation_items').where({ quotationId: id }).del();
            
            const quotationItems = items.map((item: any) => ({
                quotationId: id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            }));

            if (quotationItems.length > 0) {
                await trx('quotation_items').insert(quotationItems);
            }

            return trx('quotations').where({ id }).first();
        });
        
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'QUOTATION_UPDATE', { quotationId: id, changes: { customerId, validUntil, totalAmount } });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedQuotation);
    } catch (error) {
        next(error);
    }
};


// Use the explicitly typed handlers with the router
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), validate(createQuotationSchema), createQuotation);
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), getQuotations);
router.get('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), getQuotationDetails);
router.patch('/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), validate(updateQuotationStatusSchema), updateStatus);
router.post('/:id/to-invoice', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), convertToInvoice);
router.put('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), validate(createQuotationSchema), updateQuotation);

export default router;