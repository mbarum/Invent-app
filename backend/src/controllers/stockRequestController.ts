import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { StockRequestStatus, UserRole } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createStockRequestSchema, updateStockRequestStatusSchema } from '../validation';
import { auditLog } from '../services/auditService';
import { createNotification } from '../services/notificationService';

const router = Router();

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const createRequest = async (req: Request, res: Response, next: NextFunction) => {
    const { branchId, items } = req.body;
    const b2bUserId = req.user!.id;

    try {
        const newRequest = await db.transaction(async (trx) => {
            const productIds = items.map((item: any) => item.productId);
            const products = await trx('products').whereIn('id', productIds).select('id', 'wholesalePrice');
            const productPriceMap = new Map(products.map(p => [p.id, p.wholesalePrice]));

            const [request] = await trx('stock_requests').insert({
                b2bUserId,
                branchId,
                status: StockRequestStatus.PENDING,
            }).returning('*');

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
        res.status(201).json(newRequest);

    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getMyRequests = async (req: Request, res: Response, next: NextFunction) => {
    const b2bUserId = req.user!.id;
    try {
        const requests = await db('stock_requests')
            .select('stock_requests.*')
            .leftJoin('stock_request_items', 'stock_requests.id', 'stock_request_items.stockRequestId')
            .where({ b2bUserId })
            .groupBy('stock_requests.id')
            .count('stock_request_items.id as itemCount')
            .orderBy('stock_requests.createdAt', 'desc');
        res.status(200).json(requests);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
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
        res.status(200).json(requests);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getRequestDetails = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const request = await db('stock_requests').where({ id }).first();
        if (!request) return res.status(404).json({ message: 'Request not found.' });

        // Access control: only owner or manager can view
        if (req.user!.role === UserRole.B2B_CLIENT && req.user!.id !== request.b2bUserId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const items = await db('stock_request_items')
            .select('stock_request_items.*', 'products.partNumber', 'products.name as productName')
            .leftJoin('products', 'stock_request_items.productId', 'products.id')
            .where({ stockRequestId: id });
            
        res.status(200).json({ ...request, items });
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const [updatedRequest] = await db('stock_requests').where({ id }).update({ status }).returning('*');
        if (!updatedRequest) return res.status(404).json({ message: 'Request not found.' });
        
        await createNotification(
            updatedRequest.b2bUserId,
            `Your stock request #${id} has been ${status.toLowerCase()}.`,
            '/b2b-portal',
            'STOCK_REQUEST_STATUS_CHANGE',
            id
        );

        await auditLog(req.user!.id, 'STOCK_REQUEST_STATUS_UPDATE', { requestId: id, newStatus: status });
        res.status(200).json(updatedRequest);
    } catch (error) {
        next(error);
    }
};


router.post('/', isAuthenticated, hasPermission(PERMISSIONS.USE_B2B_PORTAL), validate(createStockRequestSchema), createRequest);
router.get('/my', isAuthenticated, hasPermission(PERMISSIONS.USE_B2B_PORTAL), getMyRequests);
router.get('/all', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), getAllRequests);
router.get('/:id', isAuthenticated, getRequestDetails); // Permissions checked inside
router.patch('/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), validate(updateStockRequestStatusSchema), updateStatus);

export default router;