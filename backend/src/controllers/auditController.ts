// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getLogs = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
    const page = parseInt(req.query.page as string) || 1;
    // FIX: Correctly access req.query by using the full express.Request type.
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

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ logs, total: totalResult ? Number((totalResult as any).total) : 0 });
    } catch (error) {
        next(error);
    }
};

// Use the explicitly typed handlers with the router
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS), getLogs);

export default router;