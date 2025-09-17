import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import db from '../db';
import { User } from '@masuma-ea/types';
import { OAuth2Client } from 'google-auth-library';
import { validate } from '../validation';
import { loginSchema, googleLoginSchema } from '../validation';
import { auditLog } from '../services/auditService';

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const router = Router();

const sanitizeUser = (user: any): User => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser as User;
};

// FIX: Add explicit types to controller function parameters.
const login = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    try {
        const user = await db('users').where({ email }).first();
        if (!user || user.status === 'Inactive' || !user.passwordHash) {
            return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        const userSessionData = sanitizeUser(user);
        req.session.user = userSessionData;
        
        await auditLog(user.id, 'USER_LOGIN', { email });

        res.status(200).json({ user: userSessionData });

    } catch (error) {
        next(error);
    }
};

// FIX: Add explicit types to controller function parameters.
const loginWithGoogle = async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(400).json({ message: 'Invalid Google token.' });
        }

        const user = await db('users').where({ email: payload.email }).first();

        if (!user) {
           return res.status(403).json({ message: 'Google account is not associated with an existing user.' });
        }
        
        if (user.status === 'Inactive') {
            return res.status(403).json({ message: 'Your account is inactive.' });
        }
        
        const userSessionData = sanitizeUser(user);
        req.session.user = userSessionData;

        await auditLog(user.id, 'USER_LOGIN_GOOGLE', { email: user.email });
        
        res.status(200).json({ user: userSessionData });

    } catch (error) {
        next(error);
    }
};

// FIX: Add explicit types to controller function parameters.
const logout = (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session.user?.id;
    req.session.destroy(async (err) => {
        if (err) {
            return next(err);
        }
        if (userId) {
            await auditLog(userId, 'USER_LOGOUT', {});
        }
        res.clearCookie('connect.sid'); 
        res.status(204).send();
    });
};

// FIX: Add explicit types to controller function parameters.
const verifyAuth = (req: Request, res: Response) => {
    if (req.session && req.session.user) {
        res.status(200).json(req.session.user);
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

router.post('/login', validate(loginSchema), login);
router.post('/login-google', validate(googleLoginSchema), loginWithGoogle);
router.post('/logout', logout);
router.get('/verify', verifyAuth);

export default router;
