// FIX: Added Request, Response, and NextFunction to imports for explicit typing.
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { AppSettings } from '@masuma-ea/types';
import { validate } from '../validation';
import { updateSettingsSchema } from '../validation';
import { auditLog } from '../services/auditService';

const router = Router();

// Helper to transform DB rows to a single settings object
const formatSettings = (rows: { settingKey: string, settingValue: string }[]): Partial<AppSettings> => {
    return rows.reduce((acc, row) => {
        // Handle numeric values
        if (['taxRate', 'invoiceDueDays', 'lowStockThreshold'].includes(row.settingKey)) {
            (acc as any)[row.settingKey] = Number(row.settingValue);
        } else {
            (acc as any)[row.settingKey] = row.settingValue;
        }
        return acc;
    }, {});
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const getSettings: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settingsRows = await db('app_settings').select('*');
        const settings = formatSettings(settingsRows);
        res.status(200).json(settings);
    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed controller function parameters to resolve "No overload matches this call" errors.
const updateSettings: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const settings: Partial<AppSettings> = req.body;
    try {
        const settingsToInsert = Object.entries(settings)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => ({
                settingKey: key,
                settingValue: String(value),
            }));

        if (settingsToInsert.length > 0) {
            await db('app_settings')
                .insert(settingsToInsert)
                .onConflict('settingKey')
                .merge();
        }
        
        const updatedSettingsRows = await db('app_settings').select('*');
        const formatted = formatSettings(updatedSettingsRows);

        await auditLog(req.user!.id, 'SETTINGS_UPDATE', { changes: req.body });

        res.status(200).json(formatted);
    } catch (error) {
        next(error);
    }
};

router.get('/', isAuthenticated, getSettings);
router.put('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_SETTINGS), validate(updateSettingsSchema), updateSettings);

export default router;