// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { productSchema, updateProductSchema } from '../validation';
import { auditLog } from '../services/auditService';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';


const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to manage OEM numbers in a transaction
const manageOemNumbers = async (trx: any, productId: string, oemNumbers: string[] = []) => {
    await trx('product_oem_numbers').where({ productId }).del();
    if (oemNumbers.length > 0) {
        const oemRecords = oemNumbers.map(oem => ({ productId, oemNumber: oem }));
        await trx('product_oem_numbers').insert(oemRecords);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.query by using the full express.Request type.
    const { page = 1, limit = 15, searchTerm, outOfStock } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        const query = db('products').select('*');

        if (searchTerm) {
            query.where(builder => 
                builder.where('name', 'like', `%${searchTerm}%`)
                       .orWhere('partNumber', 'like', `%${searchTerm}%`)
            );
        }

        if (outOfStock === 'true') {
            query.where('stock', '<=', 0);
        }

        const totalQuery = query.clone().clearSelect().count('* as total').first();
        const dataQuery = query.orderBy('name', 'asc').limit(Number(limit)).offset(offset);

        const [totalResult, products] = await Promise.all([totalQuery, dataQuery]);
        
        // Fetch OEM numbers for the paginated results
        const productIds = products.map(p => p.id);
        const oemNumbers = await db('product_oem_numbers').whereIn('productId', productIds);
        const productsWithOems = products.map(p => ({
            ...p,
            oemNumbers: oemNumbers.filter(o => o.productId === p.id).map(o => o.oemNumber)
        }));

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ products: productsWithOems, total: totalResult ? Number((totalResult as any).total) : 0 });

    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { oemNumbers, ...productData } = req.body;
    const productId = uuidv4();

    try {
        await db.transaction(async (trx) => {
            await trx('products').insert({ id: productId, ...productData });
            const newProduct = await trx('products').where({ id: productId }).first();
            await manageOemNumbers(trx, productId, oemNumbers);
            // FIX: Correctly access req.user by using the full express.Request type.
            await auditLog(req.user!.id, 'PRODUCT_CREATE', { productId, partNumber: newProduct.partNumber });
            // FIX: Correctly access res.status by using the full express.Response type.
            res.status(201).json({ ...newProduct, oemNumbers });
        });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { id } = req.params;
    // FIX: Correctly access req.body by using the full express.Request type.
    const { oemNumbers, ...productData } = req.body;

    try {
        await db.transaction(async (trx) => {
            const count = await trx('products').where({ id }).update(productData);
            if (count === 0) {
                // FIX: Correctly access res.status by using the full express.Response type.
                return res.status(404).json({ message: 'Product not found.' });
            }
            const updatedProduct = await trx('products').where({ id }).first();
            
            if (oemNumbers !== undefined) { // Allow updating OEM numbers even if it's an empty array
                await manageOemNumbers(trx, id, oemNumbers);
            }
            // FIX: Correctly access req.user and req.body by using the full express.Request type.
            await auditLog(req.user!.id, 'PRODUCT_UPDATE', { productId: id, changes: req.body });
            
            const finalOems = oemNumbers !== undefined ? oemNumbers : await db('product_oem_numbers').where({ productId: id }).pluck('oemNumber');
            // FIX: Correctly access res.status by using the full express.Response type.
            res.status(200).json({ ...updatedProduct, oemNumbers: finalOems });
        });
    } catch (error) {
        next(error);
    }
};

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const bulkImportProducts = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.file by using the full express.Request type.
    if (!req.file) {
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(400).json({ message: 'CSV file is required.' });
    }

    const results: any[] = [];
    const errors: string[] = [];
    let successCount = 0;

    // FIX: Correctly access req.file by using the full express.Request type.
    const stream = Readable.from(req.file.buffer);

    stream.pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (let i = 0; i < results.length; i++) {
                const row = results[i];
                const rowNum = i + 2; // CSV is 1-based, plus header

                try {
                    await db.transaction(async trx => {
                        // Normalize data
                        const productData = {
                            partNumber: row.partNumber,
                            name: row.name,
                            retailPrice: parseFloat(row.retailPrice),
                            wholesalePrice: parseFloat(row.wholesalePrice),
                            stock: parseInt(row.stock, 10),
                            notes: row.notes || null,
                            oemNumbers: row.oemNumbers ? row.oemNumbers.split(',').map((s: string) => s.trim()) : [],
                        };

                        // Validate data
                        if (!productData.partNumber || !productData.name || isNaN(productData.retailPrice) || isNaN(productData.wholesalePrice) || isNaN(productData.stock)) {
                            throw new Error('Missing required fields (partNumber, name, retailPrice, wholesalePrice, stock).');
                        }

                        // Upsert logic
                        const existingProduct = await trx('products').where({ partNumber: productData.partNumber }).first();
                        
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { oemNumbers, ...dbProductData } = productData;

                        if (existingProduct) {
                            // Update
                            await trx('products').where({ id: existingProduct.id }).update(dbProductData);
                            await manageOemNumbers(trx, existingProduct.id, productData.oemNumbers);
                        } else {
                            // Insert
                            const productId = uuidv4();
                            await trx('products').insert({ id: productId, ...dbProductData });
                            await manageOemNumbers(trx, productId, productData.oemNumbers);
                        }
                    });

                    successCount++;
                } catch (error: any) {
                    console.error(`Error processing row ${rowNum} during bulk import:`, error);
                    errors.push(`Row ${rowNum}: ${error.message}`);
                }
            }

            // FIX: Correctly access req.user by using the full express.Request type.
            await auditLog(req.user!.id, 'PRODUCT_BULK_IMPORT', { successCount, errorCount: errors.length });

            // FIX: Correctly access res.status by using the full express.Response type.
            res.status(200).json({
                successCount,
                errorCount: errors.length,
                errors
            });
        });
};

// Use the explicitly typed handlers with the router
// FIX: Corrected express type usage, which resolves the 'No overload matches this call' error.
router.get('/', isAuthenticated, getProducts);
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), validate(productSchema), createProduct);
router.put('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), validate(updateProductSchema), updateProduct);
router.post('/bulk-import', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), upload.single('file'), bulkImportProducts);

export default router;