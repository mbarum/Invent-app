import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import { validate } from '../validation';
import { productSchema, updateProductSchema } from '../validation';
import { auditLog } from '../services/auditService';

const router = Router();

// Helper to manage OEM numbers in a transaction
const manageOemNumbers = async (trx: any, productId: string, oemNumbers: string[] = []) => {
    await trx('product_oem_numbers').where({ productId }).del();
    if (oemNumbers.length > 0) {
        const oemRecords = oemNumbers.map(oem => ({ productId, oemNumber: oem }));
        await trx('product_oem_numbers').insert(oemRecords);
    }
};

// FIX: Add explicit types to controller function parameters.
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

        res.status(200).json({ products: productsWithOems, total: totalResult ? Number(totalResult.total) : 0 });

    } catch (error) {
        next(error);
    }
};

// FIX: Add explicit types to controller function parameters.
const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    const { oemNumbers, ...productData } = req.body;
    const productId = uuidv4();

    try {
        await db.transaction(async (trx) => {
            const [newProduct] = await trx('products').insert({ id: productId, ...productData }).returning('*');
            await manageOemNumbers(trx, productId, oemNumbers);
            await auditLog(req.user!.id, 'PRODUCT_CREATE', { productId, partNumber: newProduct.partNumber });
            res.status(201).json({ ...newProduct, oemNumbers });
        });
    } catch (error) {
        next(error);
    }
};

// FIX: Add explicit types to controller function parameters.
const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { oemNumbers, ...productData } = req.body;

    try {
        await db.transaction(async (trx) => {
            const [updatedProduct] = await trx('products').where({ id }).update(productData).returning('*');
            if (!updatedProduct) {
                return res.status(404).json({ message: 'Product not found.' });
            }
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


router.get('/', isAuthenticated, hasPermission(PERMISSIONS.VIEW_INVENTORY), getProducts);
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), validate(productSchema), createProduct);
router.put('/:id', isAuthenticated, hasPermission(PERMISSIONS.MANAGE_INVENTORY), validate(updateProductSchema), updateProduct);

export default router;
