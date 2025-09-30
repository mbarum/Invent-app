// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import db from '../db';
import { isAuthenticated } from '../middleware/authMiddleware';
import { createNotification } from '../services/notificationService';
import { UserRole } from '@masuma-ea/types';


const router = Router();


/**
 * Checks for low stock products and creates notifications for relevant users.
 * This runs as part of the notification polling to avoid needing a separate cron job.
 * @param userId - The ID of the user triggering the check.
 * @param userRole - The role of the user.
 */
const checkAndCreateLowStockNotifications = async (userId: string, userRole: UserRole) => {
    const relevantRoles = [UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER, UserRole.INVENTORY_MANAGER];
    if (!relevantRoles.includes(userRole)) {
        return; // Don't run check for roles that don't manage inventory
    }

    try {
        const thresholdSetting = await db('app_settings').where({ settingKey: 'lowStockThreshold' }).first();
        const lowStockThreshold = thresholdSetting ? Number(thresholdSetting.settingValue) : 10;

        const lowStockProducts = await db('products').where('stock', '<=', lowStockThreshold);

        for (const product of lowStockProducts) {
            await createNotification(
                userId,
                `Low stock: "${product.name}" has only ${product.stock} units left.`,
                '/inventory',
                'LOW_STOCK',
                product.id
            );
        }
    } catch (error) {
        console.error('Failed to check/create low stock notifications:', error);
    }
};


// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.user by using the full express.Request type.
    const userId = req.user!.id;
    // FIX: Correctly access req.user by using the full express.Request type.
    const userRole = req.user!.role;

    try {
        // Piggyback the low stock check onto the notification poll for relevant users
        await checkAndCreateLowStockNotifications(userId, userRole);
        
        // This endpoint can be expanded to include other notification types
        const userAlerts = await db('notifications')
            .where({ userId })
            .orderBy('createdAt', 'desc')
            .limit(20);

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ userAlerts });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const markRead = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.user by using the full express.Request type.
    const userId = req.user!.id;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(400).json({ message: 'Notification IDs must be a non-empty array.' });
    }
    
    try {
        await db('notifications')
            .where({ userId })
            .whereIn('id', ids)
            .update({ isRead: true });
            
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// Use the explicitly typed handlers with the router
router.get('/', isAuthenticated, getNotifications);
router.post('/mark-read', isAuthenticated, markRead);

export default router;