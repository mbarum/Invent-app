// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
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
    
    // FIX: Added stock validation to prevent race conditions during payment processing.
    // If stock is insufficient, this will throw an error, causing the transaction
    // to roll back and allowing the M-Pesa callback to mark the payment as 'Failed'.
    if (items && items.length > 0) {
        for (const item of items) {
            const product = await dbOrTrx('products').where({ id: item.productId }).first();
            if (!product || product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product ${product?.name || item.productId}. Available: ${product?.stock}, Requested: ${item.quantity}`);
            }
        }
    }
    
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
    
    const newSale = await dbOrTrx('sales').where({ id: saleId }).first();
    if (!newSale) {
        throw new Error('Failed to create or retrieve sale after insert.');
    }

    if (items && items.length > 0) {
        const saleItems = items.map((item: any) => ({
            saleId: newSale.id,
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
    }
    
    if (invoiceId) {
        await dbOrTrx('invoices')
            .where({ id: invoiceId })
            .update({
                status: InvoiceStatus.PAID,
                amountPaid: db.raw(`amount_paid + ?`, [totalAmount])
            });
    }
    
    // Fetch and return the full sale object with items and related data
    const saleItemsWithDetails = await dbOrTrx('sale_items')
        .select('sale_items.*', 'products.name as productName', 'products.partNumber')
        .leftJoin('products', 'sale_items.productId', 'products.id')
        .where({ saleId: newSale.id });
        
    const customer = await dbOrTrx('customers').where({id: newSale.customerId}).first();
    const branch = await dbOrTrx('branches').where({id: newSale.branchId}).first();

    return { ...newSale, items: saleItemsWithDetails, customer, branch };
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newSale = await db.transaction(async (trx) => {
            // FIX: Correctly access req.body by using the full express.Request type.
            return await createSaleInTransaction(req.body, trx);
        });
        
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'SALE_CREATE', { saleId: newSale.id, saleNo: newSale.saleNo });

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(newSale);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getSales = async (req: Request, res: Response, next: NextFunction) => {
     // FIX: Correctly access req.query by using the full express.Request type.
     const { page = 1, limit = 15, start, end, searchTerm, customerId } = req.query;
     const offset = (Number(page) - 1) * Number(limit);
     
    try {
        const query = db('sales')
            .select('sales.*', 'customers.name as customerName', 'branches.name as branchName')
            .leftJoin('customers', 'sales.customerId', 'customers.id')
            .leftJoin('branches', 'sales.branchId', 'branches.id')
            .leftJoin('sale_items', 'sales.id', 'sale_items.saleId')
            .groupBy('sales.id')
            .count('sale_items.id as itemCount');
            
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
        
        const totalQuery = db.from(query.as('subQuery')).count('* as total').first();

        const dataQuery = query
            .orderBy('sales.createdAt', 'desc')
            .limit(Number(limit))
            .offset(offset);
            
        const [totalResult, sales] = await Promise.all([totalQuery, dataQuery]);

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ sales, total: totalResult ? Number((totalResult as any).total) : 0 });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getSaleDetails = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    try {
        const sale = await db('sales').where('sales.id', id).first();
        if (!sale) return res.status(404).json({ message: 'Sale not found.' });

        const items = await db('sale_items')
            .select('sale_items.*', 'products.partNumber', 'products.name as productName')
            .leftJoin('products', 'sale_items.productId', 'products.id')
            .where({ saleId: id });
            
        const customer = await db('customers').where({ id: sale.customerId }).first();
        const branch = await db('branches').where({ id: sale.branchId }).first();

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ ...sale, items, customer, branch });
    } catch (error) {
        next(error);
    }
};

router.post('/', isAuthenticated, hasPermission(PERMISSIONS.USE_POS), validate(createSaleSchema), createSale);
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_SALES), getSales);
router.get('/:id', isAuthenticated, hasPermission(PERMISSIONS.VIEW_SALES), getSaleDetails);

// FIX: Add missing default export for the router.
export default router;