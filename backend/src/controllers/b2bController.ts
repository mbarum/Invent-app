import { Router } from 'express';
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

// FIX: Removed explicit types from controller function parameters to allow for correct type inference.
const registerB2B = async (req, res, next) => {
    const { businessName, kraPin, contactName, contactEmail, contactPhone, password } = req.body;
    
    if (!req.files || !('certOfInc' in req.files) || !('cr12' in req.files)) {
        return res.status(400).json({ message: 'Both Certificate of Incorporation and CR12 documents are required.' });
    }

    const certOfIncFile = (req.files as any).certOfInc[0];
    const cr12File = (req.files as any).cr12[0];

    try {
        // Check if user or application already exists
        const existingUser = await db('users').where('email', contactEmail).first();
        const existingApp = await db('b2b_applications').where('contactEmail', contactEmail).first();
        if (existingUser || existingApp) {
            return res.status(409).json({ message: 'An account with this email already exists or is pending review.' });
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

// FIX: Removed explicit types from controller function parameters to allow for correct type inference.
const getApplications = async (req, res, next) => {
    try {
        const applications = await db('b2b_applications').select('*').orderBy('submittedAt', 'desc');
        res.status(200).json(applications);
    } catch (error) {
        next(error);
    }
};

// FIX: Removed explicit types from controller function parameters to allow for correct type inference.
const updateApplicationStatus = async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body as { status: ApplicationStatus };
    const adminUser = req.user!;

    try {
        const application = await db('b2b_applications').where({ id }).first();
        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }
        
        if (application.status !== ApplicationStatus.PENDING) {
            return res.status(400).json({ message: `Application has already been ${application.status.toLowerCase()}.` });
        }

        await db.transaction(async (trx) => {
            await trx('b2b_applications').where({ id }).update({ status });

            if (status === ApplicationStatus.APPROVED) {
                const newUser = {
                    id: uuidv4(),
                    name: application.contactName,
                    email: application.contactEmail,
                    passwordHash: application.passwordHash,
                    role: UserRole.B2B_CLIENT,
                    b2bApplicationId: application.id,
                    status: 'Active',
                };
                await trx('users').insert(newUser);
            }
        });
        
        await sendApplicationStatusEmail(application.contactEmail, application.contactName, status);
        await auditLog(adminUser.id, 'B2B_APP_STATUS_UPDATE', { applicationId: id, newStatus: status });

        res.status(200).json({ ...application, status });
    } catch (error) {
        next(error);
    }
};

const uploadFields = upload.fields([
    { name: 'certOfInc', maxCount: 1 },
    { name: 'cr12', maxCount: 1 }
]);

router.post('/register', uploadFields, validate(registerSchema), registerB2B);
router.get('/applications', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), getApplications);
router.patch('/applications/:id/status', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_B2B_APPLICATIONS), validate(updateB2BStatusSchema), updateApplicationStatus);

export default router;