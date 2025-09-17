



import { Router, Request, Response, NextFunction } from 'express';
import { Knex } from 'knex';
import db from '../db';
import { Sale, InvoiceStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createSaleSchema } from '../validation';
import { auditLog } from '../services/auditService';

const router = Router();

// This function is exported to be used by M-Pesa controller within a transaction
export const createSaleInTransaction = async (saleData: any, trx?: Knex.Transaction): Promise<Sale> => {
    const dbOrTrx = trx || db;

    const { customerId, branchId, items, discountAmount, taxAmount, totalAmount, paymentMethod, invoiceId } = saleData;
    
    // FIX: Knex with MySQL returns the insertId, not the full object.
    // The `.returning()` method is not supported and was causing `newSale.id` to be undefined.
    const [saleId] = await dbOrTrx('sales').insert({
        saleNo: `SALE-${Date.now()}`,
        customerId,
        branchId,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMethod,
        invoiceId,
    });

    const saleItems = items.map((item: any) => ({
        saleId: saleId, // Use the returned ID directly.
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
    }));

    await dbOrTrx('sale_items').insert(saleItems);

    // Update stock levels
    for (const item of items) {
        await dbOrTrx('products')
            .where({ id: item.productId })
            .decrement('stock', item.quantity);
    }

    // If paying for an invoice, update its status
    if (invoiceId) {
        await dbOrTrx('invoices')
            .where({ id: invoiceId })
            .update({ status: InvoiceStatus.PAID, amountPaid: totalAmount });
    }
    
    // FIX: Fetch the newly created sale object to return it, since the insert only gives us the ID.
    const newSale = await dbOrTrx('sales').where({ id: saleId }).first();
    if (!newSale) {
        // This should theoretically not happen if the insert succeeded.
        throw new Error('Failed to retrieve newly created sale.');
    }

    return newSale;
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const createSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newSale = await db.transaction(async (trx) => {
            return createSaleInTransaction(req.body, trx);
        });
        
        await auditLog(req.user!.id, 'SALE_CREATE', { saleId: newSale.id, total: newSale.totalAmount });

        // Refetch with details for the receipt
        const detailedSale = await getSaleDetailsById(newSale.id);
        res.status(201).json(detailedSale);

    } catch (error) {
        next(error);
    }
};


// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getSales = async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 15, start, end, searchTerm, customerId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        const query = db('sales')
            .select('sales.*', 'customers.name as customerName', 'branches.name as branchName')
            .leftJoin('customers', 'sales.customerId', 'customers.id')
            .leftJoin('branches', 'sales.branchId', 'branches.id')
            .leftJoin('sale_items', 'sales.id', 'sale_items.saleId')
            .groupBy('sales.id')
            .count('sale_items.id as itemCount')
            .orderBy('sales.createdAt', 'desc');

        if (start && end) {
            query.whereBetween('sales.createdAt', [`${start} 00:00:00`, `${end} 23:59:59`]);
        }
        if (customerId && customerId !== 'All') {
            query.where('sales.customerId', customerId as string);
        }
        if (searchTerm) {
            query.where(builder => 
                builder.where('sales.saleNo', 'like', `%${searchTerm}%`)
                       .orWhere('customers.name', 'like', `%${searchTerm}%`)
                       .orWhere('branches.name', 'like', `%${searchTerm}%`)
            );
        }
        
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
        const dataQuery = query.limit(Number(limit)).offset(offset);

        const [totalResult, sales] = await Promise.all([totalQuery, dataQuery]);

        res.status(200).json({ sales, total: totalResult ? Number((totalResult as any).total) : 0 });
    } catch (error) {
        next(error);
    }
};

const getSaleDetailsById = async (id: number) => {
    const sale = await db('sales').where('sales.id', id).first();
    if (!sale) return null;

    const items = await db('sale_items')
        .select('sale_items.*', 'products.name as productName')
        .leftJoin('products', 'sale_items.productId', 'products.id')
        .where({ saleId: id });
    const customer = await db('customers').where({ id: sale.customerId }).first();
    const branch = await db('branches').where({ id: sale.branchId }).first();

    return { ...sale, items, customer, branch };
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getSaleDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const saleDetails = await getSaleDetailsById(Number(req.params.id));
        if (!saleDetails) return res.status(404).json({ message: 'Sale not found.' });
        res.status(200).json(saleDetails);
    } catch (error) {
        next(error);
    }
};

router.post('/', isAuthenticated, hasPermission(PERMISSIONS.USE_POS), validate(createSaleSchema), createSale);
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_SALES), getSales);
router.get('/:id', isAuthenticated, hasPermission(PERMISSIONS.VIEW_SALES), getSaleDetails);

export default router;