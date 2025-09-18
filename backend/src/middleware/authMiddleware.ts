import { User, UserRole } from '@masuma-ea/types';
import { PERMISSIONS, ROLES } from '../config/permissions';
import { Request, Response, NextFunction, RequestHandler } from 'express';
// FIX: Import express-session to augment the Request type with the 'session' property.
import 'express-session';

// FIX: Changed to use RequestHandler type to ensure correct type inference for req, res, and next.
export const isAuthenticated: RequestHandler = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }
    res.status(401).json({ message: 'Authentication required. Please log in.' });
};

// FIX: Removed explicit types on inner function parameters; they are inferred from RequestHandler.
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