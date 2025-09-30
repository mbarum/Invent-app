import { User, UserRole } from '@masuma-ea/types';
import { PERMISSIONS, ROLES } from '../config/permissions';
// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties. Moved before express import.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction } from 'express';


// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.session by using the full express.Request type.
    if (req.session && req.session.user) {
        // FIX: Correctly access req.user and req.session by using the full express.Request type.
        req.user = req.session.user;
        return next();
    }
    // FIX: Correctly access res.status by using the full express.Response type.
    res.status(401).json({ message: 'Authentication required. Please log in.' });
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
export const hasPermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // FIX: Correctly access req.user by using the full express.Request type.
        if (!req.user) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(401).json({ message: 'Authentication required.' });
        }
        
        // FIX: Correctly access req.user by using the full express.Request type.
        const userRole = req.user.role as UserRole;
        
        // System admin has all permissions
        if (userRole === UserRole.SYSTEM_ADMINISTRATOR) {
            return next();
        }

        const userPermissions = ROLES[userRole] || [];
        if (userPermissions.includes(permission)) {
            return next();
        }
        
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    };
};

/**
 * Middleware to check if a user has at least one of the specified permissions.
 * @param permissions An array of permission strings to check against.
 * @returns An Express middleware function.
 */
export const hasOneOfPermissions = (permissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // FIX: Correctly access req.user by using the full express.Request type.
        if (!req.user) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(401).json({ message: 'Authentication required.' });
        }
        
        // FIX: Correctly access req.user by using the full express.Request type.
        const userRole = req.user.role as UserRole;
        
        // System admin has all permissions and passes automatically.
        if (userRole === UserRole.SYSTEM_ADMINISTRATOR) {
            return next();
        }

        const userPermissions = ROLES[userRole] || [];
        const hasRequiredPermission = permissions.some(p => userPermissions.includes(p));

        if (hasRequiredPermission) {
            return next();
        }
        
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    };
};