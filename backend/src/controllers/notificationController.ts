import { Router } from 'express';
import db from '../db';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = Router();

// FIX: Removed explicit types from controller function parameters to allow for correct type inference.
const getNotifications = async (req, res, next) => {
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

// FIX: Removed explicit types from controller function parameters to allow for correct type inference.
const markRead = async (req, res, next) => {
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