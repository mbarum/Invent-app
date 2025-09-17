import { Router, Request, Response, NextFunction } from 'express';
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

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 15, searchTerm } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        const query = db('products').select('*');

        if (searchTerm) {
            query.where(builder => 
                builder.where('name', 'like', `%${searchTerm}%`)
                       .orWhere('partNumber', 'like', `%${searchTerm}%`)
            );
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

        res.status(200).json({ products: productsWithOems, total: totalResult ? Number((totalResult as any).total) : 0 });

    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    const { oemNumbers, ...productData } = req.body;
    const productId = uuidv4();

    try {
        await db.transaction(async (trx) => {
            await trx('products').insert({ id: productId, ...productData });
            const newProduct = await trx('products').where({ id: productId }).first();
            await manageOemNumbers(trx, productId, oemNumbers);
            await auditLog(req.user!.id, 'PRODUCT_CREATE', { productId, partNumber: newProduct.partNumber });
            res.status(201).json({ ...newProduct, oemNumbers });
        });
    } catch (error) {
        next(error);
    }
};

// FIX: Correctly typed the handler parameters to ensure proper type inference for req, res, and next.
const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { oemNumbers, ...productData } = req.body;

    try {
        await db.transaction(async (trx) => {
            const count = await trx('products').where({ id }).update(productData);
            if (count === 0) {
                return res.status(404).json({ message: 'Product not found.' });
            }
            const updatedProduct = await trx('products').where({ id }).first();
            
            if (oemNumbers !== undefined) { // Allow updating OEM numbers even if it's an empty array
                await manageOemNumbers(trx, id, oemNumbers);
            }
            await auditLog(req.user!.id, 'PRODUCT_UPDATE', { productId: id, changes: req.body });
            
            const finalOems = oemNumbers !== undefined ? oemNumbers : await db('product_oem_numbers').where({ productId: id }).pluck('oemNumber');
            res.status(200).json({ ...updatedProduct, oemNumbers: finalOems });
        });
    } catch (error) {
        next(error);
    }
};

const bulkImportProducts = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        return res.status(400).json({ message: 'CSV file is required.' });
    }

    const records: any[] = [];
    const errors: string[] = [];
    let successCount = 0;

    const parser = csv({
        mapHeaders: ({ header }) => header.trim(),
        skipComments: true,
    });

    try {
        await new Promise<void>((resolve, reject) => {
            Readable.from(req.file!.buffer)
                .pipe(parser)
                .on('data', (row) => records.push(row))
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        const productsToUpsert: any[] = [];
        const oemMap = new Map<string, string[]>();
        const allPartNumbers: string[] = [];

        records.forEach((row, index) => {
            const { partNumber, name, retailPrice, wholesalePrice, stock, oemNumbers, notes } = row;

            if (!partNumber || !name) {
                errors.push(`Row ${index + 2}: Missing required fields partNumber or name.`);
                return;
            }
            
            const retailPriceNum = parseFloat(retailPrice);
            const wholesalePriceNum = parseFloat(wholesalePrice);
            const stockNum = parseInt(stock, 10);

            if (isNaN(retailPriceNum) || isNaN(wholesalePriceNum) || isNaN(stockNum)) {
                errors.push(`Row ${index + 2}: Invalid number format for price or stock.`);
                return;
            }

            productsToUpsert.push({
                id: uuidv4(), // Provide a UUID for potential insertion
                partNumber,
                name,
                retailPrice: retailPriceNum,
                wholesalePrice: wholesalePriceNum,
                stock: stockNum,
                notes: notes || null,
            });
            
            if (oemNumbers) {
                oemMap.set(partNumber, oemNumbers.split(',').map(s => s.trim()).filter(Boolean));
            }
            allPartNumbers.push(partNumber);
            successCount++;
        });

        if (productsToUpsert.length > 0) {
            await db.transaction(async (trx) => {
                // Upsert products. On conflict (partNumber exists), merge updates.
                await trx('products')
                    .insert(productsToUpsert)
                    .onConflict('partNumber')
                    .merge();

                // Get the IDs of all processed products (both new and updated)
                const upsertedProducts = await trx('products').whereIn('partNumber', allPartNumbers).select('id', 'partNumber');
                const partNumberToIdMap = new Map(upsertedProducts.map(p => [p.partNumber, p.id]));
                const productIds = upsertedProducts.map(p => p.id);

                // Clear existing OEM numbers for all affected products
                await trx('product_oem_numbers').whereIn('productId', productIds).del();

                // Prepare new OEM numbers for batch insert
                const oemRecordsToInsert: any[] = [];
                oemMap.forEach((oems, partNumber) => {
                    const productId = partNumberToIdMap.get(partNumber);
                    if (productId && oems.length > 0) {
                        oems.forEach(oemNumber => {
                            oemRecordsToInsert.push({ productId, oemNumber });
                        });
                    }
                });

                if (oemRecordsToInsert.length > 0) {
                    await trx('product_oem_numbers').insert(oemRecordsToInsert);
                }
            });
        }
        
        await auditLog(req.user!.id, 'PRODUCT_BULK_IMPORT', { successCount, errorCount: errors.length });
        res.status(200).json({ successCount, errorCount: errors.length, errors });

    } catch (error) {
        next(error);
    }
};

router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_INVENTORY), getProducts);
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), validate(productSchema), createProduct);
router.put('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), validate(updateProductSchema), updateProduct);
router.post('/bulk-import', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), upload.single('file'), bulkImportProducts);

export default router;
