// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../db';
import { User } from '@masuma-ea/types';
import { OAuth2Client } from 'google-auth-library';
import { validate } from '../validation';
import { loginSchema, googleLoginSchema } from '../validation';
import { auditLog } from '../services/auditService';


// The VITE_ prefix is for frontend variables. The backend should use its own non-prefixed env var.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
    console.error("CRITICAL: GOOGLE_CLIENT_ID environment variable is not set for the backend. Google Sign-In will fail verification.");
}
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const router = Router();

const sanitizeUser = (user: any): User => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser as User;
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const login = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { email, password } = req.body;
    try {
        const user = await db('users').where({ email }).first();
        if (!user || user.status === 'Inactive' || !user.passwordHash) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        const userSessionData = sanitizeUser(user);
        // FIX: Correctly access req.session by using the full express.Request type.
        req.session.user = userSessionData;
        
        await auditLog(user.id, 'USER_LOGIN', { email });

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ user: userSessionData });

    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const loginWithGoogle = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(400).json({ message: 'Invalid Google token.' });
        }

        const user = await db('users').where({ email: payload.email }).first();

        if (!user) {
           // FIX: Correctly access res.status by using the full express.Response type.
           return res.status(403).json({ message: 'Google account is not associated with an existing user.' });
        }
        
        if (user.status === 'Inactive') {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(403).json({ message: 'Your account is inactive.' });
        }
        
        const userSessionData = sanitizeUser(user);
        // FIX: Correctly access req.session by using the full express.Request type.
        req.session.user = userSessionData;

        await auditLog(user.id, 'USER_LOGIN_GOOGLE', { email: user.email });
        
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ user: userSessionData });

    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const logout = (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.session by using the full express.Request type.
    const userId = req.session.user?.id;
    // FIX: Correctly access req.session by using the full express.Request type.
    req.session.destroy(async (err) => {
        if (err) {
            return next(err);
        }
        if (userId) {
            await auditLog(userId, 'USER_LOGOUT', {});
        }
        // FIX: Correctly access res.clearCookie by using the full express.Response type.
        res.clearCookie('connect.sid'); 
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(204).send();
    });
};

// FIX: Use specific Request and Response types from the default express import to resolve property access errors.
const verifyAuth = (req: Request, res: Response) => {
    // FIX: Correctly access req.session by using the full express.Request type.
    if (req.session && req.session.user) {
        // FIX: Correctly access res.status and req.session by using the full express types.
        res.status(200).json(req.session.user);
    } else {
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(401).json({ message: 'Not authenticated' });
    }
};

// Use the explicitly typed handlers with the router
router.post('/login', validate(loginSchema), login);
router.post('/login-google', validate(googleLoginSchema), loginWithGoogle);
router.post('/logout', logout);
router.get('/verify', verifyAuth);

export default router;