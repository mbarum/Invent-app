/// <reference types="multer" />
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// FIX: Replaced named express import with default import to resolve type conflicts.
import express, { Request } from 'express';
import fs from 'fs';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
    }
});

// Create the multer instance
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB file size limit
    // FIX: Use specific Request type from the default express import to resolve type errors.
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        // Accept PDFs only for this application
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'));
        }
    }
});

export default upload;