import { User, UserRole } from '@masuma-ea/types';
import { PERMISSIONS, ROLES } from '../config/permissions';

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

// FIX: Removed explicit types from middleware function parameters to allow for correct type inference from Express.
// This ensures that request properties added by other middleware (like `session`) are available.
export const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }
    res.status(401).json({ message: 'Authentication required. Please log in.' });
};

// FIX: Removed explicit types from middleware function parameters for correct type inference.
export const hasPermission = (permission: string) => {
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