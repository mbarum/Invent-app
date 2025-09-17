import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getLogs = async (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const offset = (page - 1) * limit;

    try {
        const logsQuery = db('audit_logs')
            .select('audit_logs.*', 'users.name as userName')
            .leftJoin('users', 'audit_logs.userId', 'users.id')
            .orderBy('audit_logs.createdAt', 'desc')
            .limit(limit)
            .offset(offset);

        const totalQuery = db('audit_logs').count({ total: '*' }).first();

        const [logs, totalResult] = await Promise.all([logsQuery, totalQuery]);

        res.status(200).json({ logs, total: totalResult ? Number(totalResult.total) : 0 });
    } catch (error) {
        next(error);
    }
};

router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS), getLogs);

export default router;