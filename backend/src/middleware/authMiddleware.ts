import { User, UserRole } from '@masuma-ea/types';
import { PERMISSIONS, ROLES } from '../config/permissions';
// FIX: Added Request, Response, and NextFunction to imports for explicit typing.
import { Request, Response, NextFunction, RequestHandler } from 'express';

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

// FIX: Explicitly typed middleware function parameters for correct type inference and to resolve overload errors.
export const isAuthenticated: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }
    res.status(401).json({ message: 'Authentication required. Please log in.' });
};

// FIX: Explicitly typed middleware function parameters for correct type inference and to resolve overload errors.
export const hasPermission = (permission: string): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
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