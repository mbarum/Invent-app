// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { ShippingStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createLabelSchema, updateLabelStatusSchema } from '../validation';
import { auditLog } from '../services/auditService';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getLabels = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const labels = await db('shipping_labels').select('*').orderBy('createdAt', 'desc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(labels);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createLabel = async (req: Request, res: Response, next: NextFunction) => {
    const labelId = uuidv4();
    try {
        await db('shipping_labels').insert({
            id: labelId,
            // FIX: Correctly access req.body by using the full express.Request type.
            ...req.body,
            status: ShippingStatus.DRAFT,
        });

        const newLabel = await db('shipping_labels').where({ id: labelId }).first();
        if (!newLabel) {
            // This should not happen if insert was successful, but it's a good safeguard.
            throw new Error('Failed to create or retrieve shipping label.');
        }
        
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'SHIPPING_LABEL_CREATE', { labelId: newLabel.id });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(201).json(newLabel);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { status } = req.body;
    try {
        const affectedRows = await db('shipping_labels').where({ id }).update({ status });

        if (affectedRows === 0) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(404).json({ message: 'Label not found.' });
        }

        const updatedLabel = await db('shipping_labels').where({ id }).first();
        
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'SHIPPING_LABEL_STATUS_UPDATE', { labelId: id, newStatus: status });
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedLabel);
    } catch (error) {
        next(error);
    }
};

// Use the explicitly typed handlers with the router
router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_SHIPPING), getLabels);
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_SHIPPING), validate(createLabelSchema), createLabel);
router.patch('/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_SHIPPING), validate(updateLabelStatusSchema), updateStatus);

export default router;