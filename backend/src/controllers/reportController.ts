import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    const { start, end, branchId } = req.query;
    try {
        const salesQuery = db('sales').whereBetween('createdAt', [`${start} 00:00:00`, `${end} 23:59:59`]);
        if (branchId) salesQuery.where({ branchId });

        const totalRevenueResult = await salesQuery.clone().sum({ total: 'totalAmount' }).first();
        const totalSalesResult = await salesQuery.clone().count({ total: '*' }).first();
        const activeCustomersResult = await salesQuery.clone().countDistinct({ total: 'customerId' }).first();
        
        const shipmentsQuery = db('shipping_labels').whereBetween('createdAt', [`${start} 00:00:00`, `${end} 23:59:59`]);
        const totalShipmentsResult = await shipmentsQuery.clone().count({ total: '*' }).first();
        const pendingShipmentsResult = await shipmentsQuery.clone().whereNot('status', 'Shipped').count({ total: '*' }).first();
        
        const salesTargetSetting = await db('app_settings').where({ settingKey: 'salesTarget' }).first();
        
        res.status(200).json({
            totalRevenue: Number(totalRevenueResult?.total) || 0,
            totalSales: Number(totalSalesResult?.total) || 0,
            activeCustomers: Number(activeCustomersResult?.total) || 0,
            totalShipments: Number(totalShipmentsResult?.total) || 0,
            pendingShipments: Number(pendingShipmentsResult?.total) || 0,
            salesTarget: Number(salesTargetSetting?.settingValue) || 5000000,
        });
    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const updateSalesTarget = async (req: Request, res: Response, next: NextFunction) => {
    const { salesTarget } = req.body;
    try {
        await db('app_settings')
            .insert({ settingKey: 'salesTarget', settingValue: salesTarget.toString() })
            .onConflict('settingKey')
            .merge();
        res.status(200).json({ salesTarget });
    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const getSalesChartData = async (req: Request, res: Response, next: NextFunction) => {
    const { start, end, branchId } = req.query;
    try {
        const query = db('sales')
            .select(db.raw('DATE(createdAt) as name'))
            .sum('totalAmount as revenue')
            .count('id as sales')
            .whereBetween('createdAt', [`${start} 00:00:00`, `${end} 23:59:59`])
            .groupByRaw('DATE(createdAt)')
            .orderByRaw('DATE(createdAt)');
            
        if (branchId) query.where({ branchId });
        
        const data = await query;
        res.status(200).json(data);
    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const getFastMovingProducts = async (req: Request, res: Response, next: NextFunction) => {
     const { start, end, branchId } = req.query;
    try {
        const query = db('sale_items')
            .select('products.id', 'products.name', 'products.stock as currentStock')
            .sum('sale_items.quantity as totalSold')
            .join('sales', 'sale_items.saleId', 'sales.id')
            .join('products', 'sale_items.productId', 'products.id')
            .whereBetween('sales.createdAt', [`${start} 00:00:00`, `${end} 23:59:59`])
            .groupBy('products.id')
            .orderBy('totalSold', 'desc')
            .limit(10);
            
        if (branchId) query.where('sales.branchId', branchId);
            
        const products = await query;
        res.status(200).json(products);
    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const getShipmentsReport = async (req: Request, res: Response, next: NextFunction) => {
    const { start, end } = req.query;
    try {
        const shipments = await db('shipping_labels')
            .whereBetween('createdAt', [`${start} 00:00:00`, `${end} 23:59:59`])
            .orderBy('createdAt', 'desc');
        res.status(200).json(shipments);
    } catch (error) {
        next(error);
    }
}

router.get('/dashboard-stats', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), getDashboardStats);
router.post('/sales-target', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), updateSalesTarget);
router.get('/sales-chart', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), getSalesChartData);
router.get('/fast-moving-products', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), getFastMovingProducts);
router.get('/shipments', isAuthenticated, hasPermission(PERMISSIONS.VIEW_REPORTS), getShipmentsReport);


export default router;
