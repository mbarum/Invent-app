// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import db from '../db';
import { StockRequestStatus, UserRole } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createStockRequestSchema, updateStockRequestStatusSchema, approveStockRequestSchema, initiateB2BPaymentSchema } from '../validation';
import { auditLog } from '../services/auditService';
import { createNotification } from '../services/notificationService';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createRequest = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { branchId, items } = req.body;
    // FIX: Correctly access req.user by using the full express.Request type.
    const b2bUserId = req.user!.id;

    try {
        const newRequest = await db.transaction(async (trx) => {
            const productIds = items.map((item: any) => item.productId);
            const products = await trx('products').whereIn('id', productIds).select('id', 'wholesalePrice');
            const productPriceMap = new Map(products.map(p => [p.id, p.wholesalePrice]));

            const [requestId] = await trx('stock_requests').insert({
                b2bUserId,
                branchId,
                status: StockRequestStatus.PENDING,
            });

            const request = await trx('stock_requests').where({ id: requestId }).first();

            const requestItems = items.map((item: any) => ({
                stockRequestId: request.id,
                productId: item.productId,
                quantity: item.quantity,
                wholesalePriceAtRequest: productPriceMap.get(item.productId) || 0,
            }));

            await trx('stock_request_items').insert(requestItems);
            return request;
        });

        // Notify admins/managers
        const adminsAndManagers = await db('users')
            .whereIn('role', [UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER])
            .pluck('id');
            
        for (const adminId of adminsAndManagers) {
            await createNotification(
                adminId, 
                `New stock request from ${req.user!.name}.`, 
                '/b2b-management',
                'STOCK_REQUEST_NEW',
                newRequest.id
            );
        }

        await auditLog(b2bUserId, 'STOCK_REQUEST_CREATE', { requestId: newRequest.id });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(newRequest);

    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getMyRequests = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.user by using the full express.Request type.
    const b2bUserId = req.user!.id;
    try {
        const requests = await db('stock_requests')
            .select('stock_requests.*')
            .leftJoin('stock_request_items', 'stock_requests.id', 'stock_request_items.stockRequestId')
            .where({ b2bUserId })
            .groupBy('stock_requests.id')
            .count('stock_request_items.id as itemCount')
            .orderBy('stock_requests.createdAt', 'desc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(requests);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getAllRequests = async (req: Request, res: Response, next: NextFunction) => {
     try {
        const requests = await db('stock_requests')
            .select(
                'stock_requests.*',
                'users.name as userName',
                db.raw('COUNT(stock_request_items.id) as item_count'),
                db.raw('SUM(stock_request_items.quantity * stock_request_items.wholesale_price_at_request) as total_value')
            )
            .leftJoin('users', 'stock_requests.b2bUserId', 'users.id')
            .leftJoin('stock_request_items', 'stock_requests.id', 'stock_request_items.stockRequestId')
            .groupBy('stock_requests.id', 'users.name')
            .orderBy('stock_requests.createdAt', 'desc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(requests);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getRequestDetails = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    try {
        const request = await db('stock_requests').where({ id }).first();
        if (!request) return res.status(404).json({ message: 'Request not found.' });

        // Access control: only owner or manager can view
        // FIX: Correctly access req.user by using the full express.Request type.
        if (req.user!.role === UserRole.B2B_CLIENT && req.user!.id !== request.b2bUserId) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(403).json({ message: 'Forbidden' });
        }

        const items = await db('stock_request_items')
            .select('stock_request_items.*', 'products.partNumber', 'products.name as productName')
            .leftJoin('products', 'stock_request_items.productId', 'products.id')
            .where({ stockRequestId: id });
            
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ ...request, items });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const approveRequest = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { items } = req.body; // [{ itemId: number, approvedQuantity: number }]

    try {
        const updatedRequest = await db.transaction(async trx => {
            const request = await trx('stock_requests').where({ id }).first();
            if (!request || request.status !== StockRequestStatus.PENDING) {
                throw new Error("Request not found or cannot be approved.");
            }
            
            for (const item of items) {
                await trx('stock_request_items')
                    .where({ id: item.itemId, stockRequestId: id })
                    .update({ approvedQuantity: item.approvedQuantity });
            }

            await trx('stock_requests').where({ id }).update({ status: StockRequestStatus.APPROVED });
            return trx('stock_requests').where({ id }).first();
        });
        
        await createNotification(
            updatedRequest.b2bUserId,
            `Your stock request #${id} has been approved and is pending payment.`,
            '/b2b-portal',
            'STOCK_REQUEST_STATUS_CHANGE',
            id
        );
        
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'STOCK_REQUEST_APPROVE', { requestId: id, approvedItems: items });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedRequest);
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
        const request = await db('stock_requests').where({ id }).first();
        if (!request) return res.status(404).json({ message: 'Request not found.' });
        
        await db.transaction(async trx => {
            await trx('stock_requests').where({ id }).update({ status });

            // If moving to 'Shipped', deduct stock
            if (status === StockRequestStatus.SHIPPED && request.status === StockRequestStatus.PAID) {
                const itemsToShip = await trx('stock_request_items')
                    .where({ stockRequestId: id })
                    .andWhere('approvedQuantity', '>', 0);

                for (const item of itemsToShip) {
                    await trx('products')
                        .where({ id: item.productId })
                        .decrement('stock', item.approvedQuantity);
                }
            }
        });
        
        const updatedRequest = await db('stock_requests').where({ id }).first();
        
        await createNotification(
            updatedRequest.b2bUserId,
            `Your stock request #${id} has been ${status.toLowerCase()}.`,
            '/b2b-portal',
            'STOCK_REQUEST_STATUS_CHANGE',
            id
        );

        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'STOCK_REQUEST_STATUS_UPDATE', { requestId: id, newStatus: status });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedRequest);
    } catch (error) {
        next(error);
    }
};


// Use the explicitly typed handlers with the router
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.USE_B2B_PORTAL), validate(createStockRequestSchema), createRequest);
router.get('/my', isAuthenticated, hasPermission(PERMISSIONS.USE_B2B_PORTAL), getMyRequests);
router.get('/all', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), getAllRequests);
router.get('/:id', isAuthenticated, getRequestDetails); // Permissions checked inside
router.put('/:id/approve', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), validate(approveStockRequestSchema), approveRequest);
router.patch('/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), validate(updateStockRequestStatusSchema), updateStatus);

export default router;