import { User, UserRole } from '@masuma-ea/types';
import { PERMISSIONS, ROLES } from '../config/permissions';
import { RequestHandler } from 'express';

// Extend the Express Request and Session interfaces
declare global {
    namespace Express {
        interface Request {
            user?: User; 
        }
        interface SessionData {
            user?: User;
        }
    }
}

// FIX: Correctly typed the middleware as a RequestHandler to ensure proper type inference for req, res, and next.
export const isAuthenticated: RequestHandler = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }
    res.status(401).json({ message: 'Authentication required. Please log in.' });
};

// FIX: Correctly typed the inner middleware as a RequestHandler to ensure proper type inference.
export const hasPermission = (permission: string): RequestHandler => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        
        const userRole = req.user.role as UserRole;
        
        // System admin has all permissions
        if (userRole === UserRole.SYSTEM_ADMINISTRATOR) {
            return next();
        }

        const userPermissions = ROLES[userRole] || [];
        if (userPermissions.includes(permission)) {
            return next();
        }
        
        return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    };
};