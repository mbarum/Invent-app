// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createUserSchema, updateUserSchema, updatePasswordSchema } from '../validation';
import { auditLog } from '../services/auditService';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await db('users')
            .select('id', 'name', 'email', 'role', 'status', 'b2bApplicationId', 'customerId')
            .orderBy('name', 'asc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createUser = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { name, email, password, role, status } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const userId = uuidv4();

        await db('users').insert({
            id: userId,
            name,
            email,
            passwordHash,
            role,
            status: status || 'Active',
        });
        
        const newUser = await db('users').where({ id: userId }).first();

        const { passwordHash: _, ...userToReturn } = newUser;
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'USER_CREATE', { createdUserId: newUser.id, email: newUser.email });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(userToReturn);
    } catch (error) {
        if ((error as any).code === '23505' || (error as any).code === 'ER_DUP_ENTRY') { // Unique constraint violation
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(409).json({ message: 'User with this email already exists.' });
        }
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { name, email, role, status } = req.body;
    try {
        const count = await db('users')
            .where({ id })
            .update({ name, email, role, status });

        if (count === 0) return res.status(404).json({ message: 'User not found.' });
        
        const updatedUser = await db('users').where({ id }).first();
        const { passwordHash: _, ...userToReturn } = updatedUser;
        // FIX: Correctly access req.user and req.body by using the full express.Request type.
        await auditLog(req.user!.id, 'USER_UPDATE', { updatedUserId: id, changes: req.body });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(userToReturn);
    } catch (error) {
        if ((error as any).code === '23505' || (error as any).code === 'ER_DUP_ENTRY') {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(409).json({ message: 'This email is already in use.' });
        }
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateCurrentUserPassword = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { currentPassword, newPassword } = req.body;
    // FIX: Correctly access req.user by using the full express.Request type.
    const userId = req.user!.id;
    try {
        const user = await db('users').where({ id: userId }).first();
        if (!user || !user.passwordHash) return res.status(401).json({ message: 'User not found or password not set.' });

        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) return res.status(400).json({ message: 'Incorrect current password.' });

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);
        
        await db('users').where({ id: userId }).update({ passwordHash: newPasswordHash });

        await auditLog(userId, 'USER_PASSWORD_UPDATE', { userId });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(204).send();

    } catch (error) {
        next(error);
    }
};

// Use the explicitly typed handlers with the router
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_USERS), getUsers);
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_USERS), validate(createUserSchema), createUser);
router.put('/me/password', isAuthenticated, validate(updatePasswordSchema), updateCurrentUserPassword);
router.put('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_USERS), validate(updateUserSchema), updateUser);

export default router;