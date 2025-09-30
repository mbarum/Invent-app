// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
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
        const key = row.settingKey as keyof AppSettings;
        const value = row.settingValue;
        // Coerce numeric types
        if (['taxRate', 'invoiceDueDays', 'lowStockThreshold'].includes(key as string)) {
            (acc as any)[key] = Number(value);
        } else {
            (acc as any)[key] = value;
        }
        return acc;
    }, {} as Partial<AppSettings>);
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settingsRows = await db('app_settings').select('*');
        const settings = formatSettings(settingsRows);
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(settings);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const settings: Partial<AppSettings> = req.body;
    try {
        await db.transaction(async (trx) => {
            const promises = Object.entries(settings).map(([key, value]) => {
                if (value === undefined || value === null) return Promise.resolve();
                
                // Do not update sensitive keys if they are sent as empty strings
                if (['mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaPasskey'].includes(key) && value === '') {
                    return Promise.resolve();
                }

                return trx('app_settings')
                    .insert({ settingKey: key, settingValue: String(value) })
                    .onConflict('settingKey')
                    .merge();
            });
            await Promise.all(promises);
        });
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'SETTINGS_UPDATE', { updatedKeys: Object.keys(settings) });
        const updatedSettingsRows = await db('app_settings').select('*');
        const updatedSettings = formatSettings(updatedSettingsRows);
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedSettings);
    } catch (error) {
        next(error);
    }
};

// Use the explicitly typed handlers with the router
router.get('/', isAuthenticated, getSettings);
router.put('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_SETTINGS), validate(updateSettingsSchema), updateSettings);

export default router;