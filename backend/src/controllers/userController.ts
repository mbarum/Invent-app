import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createUserSchema, updateUserSchema, updatePasswordSchema } from '../validation';
import { auditLog } from '../services/auditService';

const router = Router();

// FIX: Changed handler definition to use explicit parameter types to avoid type inference issues.
const getUsers: RequestHandler = async (req, res, next) => {
    try {
        const users = await db('users')
            .select('id', 'name', 'email', 'role', 'status', 'b2bApplicationId', 'customerId')
            .orderBy('name', 'asc');
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

// FIX: Changed handler definition to use explicit parameter types to avoid type inference issues.
const createUser: RequestHandler = async (req, res, next) => {
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
        await auditLog(req.user!.id, 'USER_CREATE', { createdUserId: newUser.id, email: newUser.email });
        res.status(201).json(userToReturn);
    } catch (error) {
        if ((error as any).code === '23505' || (error as any).code === 'ER_DUP_ENTRY') { // Unique constraint violation
            return res.status(409).json({ message: 'User with this email already exists.' });
        }
        next(error);
    }
};

// FIX: Changed handler definition to use explicit parameter types to avoid type inference issues.
const updateUser: RequestHandler = async (req, res, next) => {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    try {
        const count = await db('users')
            .where({ id })
            .update({ name, email, role, status });

        if (count === 0) return res.status(404).json({ message: 'User not found.' });
        
        const updatedUser = await db('users').where({ id }).first();
        const { passwordHash: _, ...userToReturn } = updatedUser;
        await auditLog(req.user!.id, 'USER_UPDATE', { updatedUserId: id, changes: req.body });
        res.status(200).json(userToReturn);
    } catch (error) {
        if ((error as any).code === '23505' || (error as any).code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This email is already in use.' });
        }
        next(error);
    }
};

// FIX: Changed handler definition to use explicit parameter types to avoid type inference issues.
const updateCurrentUserPassword: RequestHandler = async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
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
        res.status(204).send();

    } catch (error) {
        next(error);
    }
};

router.get('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_USERS), getUsers);
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_USERS), validate(createUserSchema), createUser);
router.put('/me/password', isAuthenticated, validate(updatePasswordSchema), updateCurrentUserPassword);
router.put('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_USERS), validate(updateUserSchema), updateUser);

export default router;