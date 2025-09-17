import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { ShippingStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createLabelSchema, updateLabelStatusSchema } from '../validation';
import { auditLog } from '../services/auditService';

const router = Router();

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const getLabels = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const labels = await db('shipping_labels').select('*').orderBy('createdAt', 'desc');
        res.status(200).json(labels);
    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const createLabel = async (req: Request, res: Response, next: NextFunction) => {
    const labelId = uuidv4();
    try {
        await db('shipping_labels').insert({
            id: labelId,
            ...req.body,
            status: ShippingStatus.DRAFT,
        });

        const newLabel = await db('shipping_labels').where({ id: labelId }).first();
        if (!newLabel) {
            // This should not happen if insert was successful, but it's a good safeguard.
            throw new Error('Failed to create or retrieve shipping label.');
        }
        
        await auditLog(req.user!.id, 'SHIPPING_LABEL_CREATE', { labelId: newLabel.id });
        res.status(201).json(newLabel);
    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const affectedRows = await db('shipping_labels').where({ id }).update({ status });

        if (affectedRows === 0) {
            return res.status(404).json({ message: 'Label not found.' });
        }

        const updatedLabel = await db('shipping_labels').where({ id }).first();
        
        await auditLog(req.user!.id, 'SHIPPING_LABEL_STATUS_UPDATE', { labelId: id, newStatus: status });
        res.status(200).json(updatedLabel);
    } catch (error) {
        next(error);
    }
};

router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_SHIPPING), getLabels);
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_SHIPPING), validate(createLabelSchema), createLabel);
router.patch('/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_SHIPPING), validate(updateLabelStatusSchema), updateStatus);

export default router;
