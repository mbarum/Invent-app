// FIX: Added Request, Response, and NextFunction to imports for explicit typing.
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import db from '../db';
import { QuotationStatus, InvoiceStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createQuotationSchema, updateQuotationStatusSchema } from '../validation';
import { auditLog } from '../services/auditService';

const router = Router();

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const createQuotation: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { customerId, branchId, items, validUntil, subtotal, discountAmount, taxAmount, totalAmount } = req.body;
    try {
        const newQuotation = await db.transaction(async (trx) => {
            const [quotation] = await trx('quotations').insert({
                quotationNo: `QUO-${Date.now()}`,
                customerId,
                branchId,
                validUntil,
                subtotal,
                discountAmount,
                taxAmount,
                totalAmount,
                status: QuotationStatus.DRAFT
            }).returning('*');

            const quotationItems = items.map((item: any) => ({
                quotationId: quotation.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            }));

            await trx('quotation_items').insert(quotationItems);
            return quotation;
        });
        
        await auditLog(req.user!.id, 'QUOTATION_CREATE', { quotationId: newQuotation.id });
        res.status(201).json(newQuotation);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getQuotations: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const quotations = await db('quotations')
            .select('quotations.*', 'customers.name as customerName')
            .leftJoin('customers', 'quotations.customerId', 'customers.id')
            .orderBy('quotations.createdAt', 'desc');
        res.status(200).json(quotations);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getQuotationDetails: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
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

        res.status(200).json({ ...quotation, items, customer, branch });
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const updateStatus: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const [updatedQuotation] = await db('quotations').where({ id }).update({ status }).returning('*');
        if (!updatedQuotation) return res.status(404).json({ message: 'Quotation not found.' });
        await auditLog(req.user!.id, 'QUOTATION_STATUS_UPDATE', { quotationId: id, newStatus: status });
        res.status(200).json(updatedQuotation);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const convertToInvoice: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
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

            const [invoice] = await trx('invoices').insert({
                invoiceNo: `INV-${Date.now()}`,
                customerId: quotation.customerId,
                branchId: quotation.branchId,
                quotationId: quotation.id,
                dueDate: dueDate.toISOString().split('T')[0],
                totalAmount: quotation.totalAmount,
                amountPaid: 0,
                status: InvoiceStatus.UNPAID
            }).returning('*');

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

        await auditLog(req.user!.id, 'QUOTATION_CONVERT_INVOICE', { quotationId: id, invoiceId: newInvoice.id });
        res.status(201).json(newInvoice);

    } catch (error) {
        next(error);
    }
};

router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), validate(createQuotationSchema), createQuotation);
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), getQuotations);
router.get('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), getQuotationDetails);
router.patch('/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_QUOTATIONS), validate(updateQuotationStatusSchema), updateStatus);
router.post('/:id/to-invoice', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVOICES), convertToInvoice);

export default router;