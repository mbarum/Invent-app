



import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = Router();

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!.id;
    try {
        // This endpoint can be expanded to include other notification types
        const userAlerts = await db('notifications')
            .where({ userId })
            .orderBy('createdAt', 'desc')
            .limit(20);

        res.status(200).json({ userAlerts });
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const markRead = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!.id;
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Notification IDs must be a non-empty array.' });
    }
    
    try {
        await db('notifications')
            .where({ userId })
            .whereIn('id', ids)
            .update({ isRead: true });
            
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

router.get('/', isAuthenticated, getNotifications);
router.post('/mark-read', isAuthenticated, markRead);

export default router;