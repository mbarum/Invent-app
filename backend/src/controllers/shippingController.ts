// FIX: Added Request, Response, and NextFunction to imports for explicit typing.
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { ShippingStatus } from '@masuma-ea/types';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { createLabelSchema, updateLabelStatusSchema } from '../validation';
import { auditLog } from '../services/auditService';

const router = Router();

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getLabels: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const labels = await db('shipping_labels').select('*').orderBy('createdAt', 'desc');
        res.status(200).json(labels);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const createLabel: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [newLabel] = await db('shipping_labels').insert({
            id: uuidv4(),
            ...req.body,
            status: ShippingStatus.DRAFT,
        }).returning('*');
        
        await auditLog(req.user!.id, 'SHIPPING_LABEL_CREATE', { labelId: newLabel.id });
        res.status(201).json(newLabel);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const updateStatus: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const [updatedLabel] = await db('shipping_labels').where({ id }).update({ status }).returning('*');
        if (!updatedLabel) return res.status(404).json({ message: 'Label not found.' });
        
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