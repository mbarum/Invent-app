// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
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
        
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({
            totalRevenue: Number(totalRevenueResult?.total) || 0,
            totalSales: Number(totalSalesResult?.total) || 0,
            activeCustomers: Number(activeCustomersResult?.total) || 0,
            totalShipments: Number(totalShipmentsResult?.total) || 0,
            pendingShipments: Number(pendingShipmentsResult?.total) || 0,
            salesTarget: Number(salesTargetSetting?.settingValue) || 0,
        });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateSalesTarget = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { salesTarget } = req.body;
    try {
        await db('app_settings')
            .insert({ settingKey: 'salesTarget', settingValue: String(salesTarget) })
            .onConflict('settingKey')
            .merge();
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ salesTarget: Number(salesTarget) });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getSalesChartData = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
    const { start, end, branchId } = req.query;
    try {
        const query = db('sales')
            .select(db.raw('DATE(createdAt) as date'), db.raw('COUNT(*) as sales'), db.raw('SUM(totalAmount) as revenue'))
            .whereBetween('createdAt', [`${start} 00:00:00`, `${end} 23:59:59`])
            .groupByRaw('DATE(createdAt)')
            .orderBy('date', 'asc');
        
        if (branchId) {
            query.where({ branchId });
        }

        const data = await query;
        const formattedData = data.map((d: any) => ({
            name: new Date(d.date).toISOString().split('T')[0],
            sales: Number(d.sales),
            revenue: Number(d.revenue)
        }));

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(formattedData);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getFastMovingProducts = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
    const { start, end, branchId } = req.query;
    try {
        const query = db('sale_items')
            .select('productId', 'products.name', 'products.stock as currentStock')
            .sum('quantity as totalSold')
            .join('sales', 'sale_items.saleId', 'sales.id')
            .join('products', 'sale_items.productId', 'products.id')
            .whereBetween('sales.createdAt', [`${start} 00:00:00`, `${end} 23:59:59`])
            .groupBy('productId', 'products.name', 'products.stock')
            .orderBy('totalSold', 'desc')
            .limit(10);
        
        if (branchId) {
            query.where('sales.branchId', branchId as any);
        }

        const products = await query;
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(products);

    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getShipmentsReport = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
    const { start, end } = req.query;
    try {
        const shipments = await db('shipping_labels')
            .whereBetween('createdAt', [`${start} 00:00:00`, `${end} 23:59:59`])
            .orderBy('createdAt', 'desc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(shipments);
    } catch (error) {
        next(error);
    }
};


// Use the explicitly typed handlers with the router
router.get('/dashboard-stats', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), getDashboardStats);
router.post('/sales-target', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), updateSalesTarget);
router.get('/sales-chart', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), getSalesChartData);
router.get('/fast-moving-products', isAuthenticated, hasPermission(PERMISSIONS.VIEW_DASHBOARD), getFastMovingProducts);
router.get('/shipments', isAuthenticated, hasPermission(PERMISSIONS.VIEW_REPORTS), getShipmentsReport);

export default router;