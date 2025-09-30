// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import db from '../db';
import { ApplicationStatus, UserRole } from '@masuma-ea/types';
import upload from '../middleware/uploadMiddleware';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { registerSchema, updateB2BStatusSchema } from '../validation';
import { auditLog } from '../services/auditService';
import { sendApplicationReceivedEmail, sendApplicationStatusEmail } from '../services/emailService';


const router = Router();

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const registerB2B = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
    
    // FIX: Correctly access req.files by using the full express.Request type.
    if (!req.files || !('certOfInc' in req.files) || !('cr12' in req.files)) {
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(400).json({ message: 'Both Certificate of Incorporation and CR12 documents are required.' });
    }

    const certOfIncFile = (req.files as any).certOfInc[0];
    const cr12File = (req.files as any).cr12[0];

    try {
        // Check if user or application already exists
        const existingUser = await db('users').where('email', contactEmail).first();
        const existingApp = await db('b2b_applications').where('contactEmail', contactEmail).first();
        if (existingUser || existingApp) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(409).json({ message: 'An account or application with this email already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newApplication = {
            id: uuidv4(),
            businessName,
            kraPin,
            contactName,
            contactEmail,
            contactPhone,
            passwordHash,
            certOfIncUrl: certOfIncFile.filename,
            cr12Url: cr12File.filename,
            status: ApplicationStatus.PENDING,
        };

        await db('b2b_applications').insert(newApplication);
        
        await sendApplicationReceivedEmail(contactEmail, contactName);

        res.status(201).json(newApplication);

    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getApplications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applications = await db('b2b_applications').select('*').orderBy('submittedAt', 'desc');
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(applications);
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateApplicationStatus = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { status } = req.body;
    try {
        const application = await db('b2b_applications').where({ id }).first();
        if (!application) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(404).json({ message: 'Application not found.' });
        }

        if (application.status !== ApplicationStatus.PENDING) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(400).json({ message: 'Application has already been processed.' });
        }

        if (status === ApplicationStatus.APPROVED) {
            await db.transaction(async (trx) => {
                await trx('users').insert({
                    id: uuidv4(),
                    name: application.contactName,
                    email: application.contactEmail,
                    passwordHash: application.passwordHash,
                    role: UserRole.B2B_CLIENT,
                    b2bApplicationId: application.id,
                    status: 'Active',
                });
                
                await trx('b2b_applications').where({ id }).update({ status: ApplicationStatus.APPROVED });
                // FIX: Correctly access req.user by using the full express.Request type.
                await auditLog(req.user!.id, 'B2B_APP_APPROVE', { applicationId: id });
            });
            await sendApplicationStatusEmail(application.contactEmail, application.contactName, ApplicationStatus.APPROVED);
        } else { // Rejected
            await db('b2b_applications').where({ id }).update({ status: ApplicationStatus.REJECTED });
            // FIX: Correctly access req.user by using the full express.Request type.
            await auditLog(req.user!.id, 'B2B_APP_REJECT', { applicationId: id });
            await sendApplicationStatusEmail(application.contactEmail, application.contactName, ApplicationStatus.REJECTED);
        }
        
        const updatedApplication = await db('b2b_applications').where({ id }).first();
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(updatedApplication);
    } catch (error) {
        next(error);
    }
};

// FIX: Corrected express type usage, which resolves the 'No overload matches this call' error.
router.post('/register', upload.fields([{ name: 'certOfInc', maxCount: 1 }, { name: 'cr12', maxCount: 1 }]), validate(registerSchema), registerB2B);
router.get('/applications', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), getApplications);
router.patch('/applications/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), validate(updateB2BStatusSchema), updateApplicationStatus);

export default router;