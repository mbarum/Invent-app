// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import axios from 'axios';
import { Buffer } from 'buffer';
import db from '../db';
// FIX: Import `hasOneOfPermissions` to allow both POS and B2B users to initiate payments.
import { isAuthenticated, hasPermission, hasOneOfPermissions } from '../middleware/authMiddleware';
import { createSaleInTransaction } from './posController';
import { PERMISSIONS } from '../config/permissions';
import { StockRequestStatus, UserRole } from '@masuma-ea/types';
import { createNotification } from '../services/notificationService';
import { Knex } from 'knex';


const router = Router();

// --- HELPER FUNCTIONS ---

const getMpesaSettings = async () => {
    const settingsRows = await db('app_settings').whereIn('settingKey', [
        'mpesaPaybill', 'mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaPasskey', 'mpesaEnvironment', 'mpesaTransactionType'
    ]).select('*');
    
    const settings = settingsRows.reduce((acc, row) => {
        (acc as any)[row.settingKey] = row.settingValue;
        return acc;
    }, {} as any);

    if (!settings.mpesaPaybill || !settings.mpesaConsumerKey || !settings.mpesaConsumerSecret || !settings.mpesaPasskey) {
        throw new Error('M-Pesa settings are not fully configured.');
    }
    
    const isLive = settings.mpesaEnvironment === 'live';
    settings.authUrl = isLive ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials' : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    settings.stkPushUrl = isLive ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest' : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    return settings;
};

// Simple in-memory cache for token
let tokenCache = {
    token: '',
    expires: 0
};

const getMpesaToken = async (settings: any) => {
    if (tokenCache.token && tokenCache.expires > Date.now()) {
        return tokenCache.token;
    }

    const auth = Buffer.from(`${settings.mpesaConsumerKey}:${settings.mpesaConsumerSecret}`).toString('base64');
    const response = await axios.get(settings.authUrl, {
        headers: { 'Authorization': `Basic ${auth}` }
    });

    tokenCache.token = response.data.access_token;
    tokenCache.expires = Date.now() + (response.data.expires_in - 60) * 1000; // a minute of buffer
    return tokenCache.token;
};

const getTimestamp = () => {
    const d = new Date();
    return d.getFullYear() +
        ('0' + (d.getMonth() + 1)).slice(-2) +
        ('0' + d.getDate()).slice(-2) +
        ('0' + d.getHours()).slice(-2) +
        ('0' + d.getMinutes()).slice(-2) +
        ('0' + d.getSeconds()).slice(-2);
};


// --- ROUTES ---

// 1. INITIATE PAYMENT
// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const initiatePayment = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { amount, phoneNumber, ...transactionDetails } = req.body;
    
    if (!amount || Number(amount) < 1 || !phoneNumber) {
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(400).json({ message: 'Amount and phone number are required.' });
    }

    try {
        const settings = await getMpesaSettings();
        const token = await getMpesaToken(settings);
        const timestamp = getTimestamp();
        const password = Buffer.from(settings.mpesaPaybill + settings.mpesaPasskey + timestamp).toString('base64');
        
        const callBackURL = `${process.env.BACKEND_URL}/api/mpesa/callback`;
        const transactionType = settings.mpesaTransactionType === 'BuyGoods' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
        
        const stkData = {
            BusinessShortCode: settings.mpesaPaybill,
            Password: password,
            Timestamp: timestamp,
            TransactionType: transactionType,
            Amount: Math.round(Number(amount)),
            PartyA: phoneNumber,
            PartyB: settings.mpesaPaybill,
            PhoneNumber: phoneNumber,
            CallBackURL: callBackURL,
            AccountReference: 'MasumaEA',
            TransactionDesc: 'Payment for goods'
        };

        const mpesaResponse = await axios.post(settings.stkPushUrl, stkData, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const { MerchantRequestID, CheckoutRequestID, ResponseCode, errorMessage } = mpesaResponse.data;

        if (ResponseCode !== '0') {
            throw new Error(errorMessage || 'Failed to initiate M-Pesa STK push.');
        }

        await db('mpesa_transactions').insert({
            checkoutRequestId: CheckoutRequestID,
            merchantRequestId: MerchantRequestID,
            amount: Number(amount),
            phoneNumber: phoneNumber,
            status: 'Pending',
            transactionDetails: JSON.stringify(transactionDetails),
        });
        
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ checkoutRequestId: CheckoutRequestID });

    } catch (error: any) {
        console.error("M-Pesa initiation error:", error.response ? JSON.stringify(error.response.data) : error.message);

        let message = 'Could not initiate payment. Please check settings or try again later.';
        let statusCode = 503; 

        if (error.message.includes('M-Pesa settings are not fully configured')) {
            message = error.message;
            statusCode = 400;
        } else if (error.response?.data?.errorMessage) { // Safaricom's expected error format
            message = `M-Pesa Error: ${error.response.data.errorMessage}`;
            statusCode = error.response.status || 400;
        } else if (error.response?.data) { // Other structured error
            const details = typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data;
            message = `An API error occurred: ${details}`;
            statusCode = error.response.status || 500;
        } else if (error.request) { // Request made but no response received
            message = 'Could not connect to the payment service. Please check network and try again.';
            statusCode = 504; // Gateway Timeout
        } else { // Something else happened
             message = `An unexpected error occurred during payment initiation: ${error.message}`;
        }
        
        const err: any = new Error(message);
        err.statusCode = statusCode;
        next(err);
    }
};


// 2. MPESA CALLBACK
// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const mpesaCallback = async (req: Request, res: Response, next: NextFunction) => {
    console.log('--- M-Pesa Callback Received ---');
    console.log(JSON.stringify(req.body, null, 2));

    // FIX: Correctly access req.body by using the full express.Request type.
    if (!req.body || !req.body.Body || !req.body.Body.stkCallback) {
        console.error('Invalid M-Pesa callback format received.');
        // We still respond with success to Safaricom to prevent retries.
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const callbackData = req.body.Body.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;

    try {
        const transaction = await db('mpesa_transactions').where({ checkoutRequestId: CheckoutRequestID }).first();
        if (!transaction) {
            console.error(`Callback for unknown CheckoutRequestID: ${CheckoutRequestID}`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Accept to prevent retries
        }

        if (ResultCode === 0) { // Success
            const callbackMetadata = callbackData.CallbackMetadata.Item;
            const mpesaReceiptNumber = callbackMetadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
            
            // FIX: Wrap order processing in a try/catch to handle failures (like low stock) after successful payment.
            try {
                await db.transaction(async (trx: Knex.Transaction) => {
                    await trx('mpesa_transactions')
                        .where({ id: transaction.id })
                        .update({
                            status: 'Completed',
                            mpesaReceiptNumber: mpesaReceiptNumber,
                            resultDesc: ResultDesc,
                        });
                    
                    // FIX: The `transactionDetails` field is already an object because the mysql2 driver
                    // automatically parses JSON columns. Calling `JSON.parse` on it again causes an
                    // error because the object is first converted to the string "[object Object]", which
                    // is invalid JSON. We now use the object directly.
                    const originalRequest = transaction.transactionDetails || {};

                    if (originalRequest.items) { // POS Sale
                        const saleData = { ...originalRequest, amount: transaction.amount, phoneNumber: transaction.phoneNumber };
                        const newSale = await createSaleInTransaction(saleData, trx);
                        await trx('mpesa_transactions').where({ id: transaction.id }).update({ saleId: newSale.id });
                        
                    } else if (originalRequest.stockRequestId) { // B2B Stock Request
                        const stockRequestId = originalRequest.stockRequestId;
                        const stockRequest = await trx('stock_requests').where({ id: stockRequestId }).first();
                        
                        if (stockRequest && stockRequest.status === 'Approved') {
                            await trx('stock_requests').where({ id: stockRequestId }).update({ status: StockRequestStatus.PAID });
                            await trx('mpesa_transactions').where({ id: transaction.id }).update({ stockRequestId: stockRequestId });
                            
                            const adminsAndManagers = await trx('users').whereIn('role', [UserRole.SYSTEM_ADMINISTRATOR, UserRole.BRANCH_MANAGER]).pluck('id');
                            for (const adminId of adminsAndManagers) {
                                await createNotification(adminId, `Payment received for stock request #${stockRequestId}.`, '/b2b-management', 'STOCK_REQUEST_PAID', stockRequestId);
                            }
                        }
                    }
                });
            } catch (orderProcessingError: any) {
                console.error(`Failed to process successful M-Pesa payment for ${CheckoutRequestID}:`, orderProcessingError.message);
                // Mark transaction as failed if order processing fails, so it's not left pending.
                await db('mpesa_transactions')
                    .where({ id: transaction.id })
                    .update({ status: 'Failed', resultDesc: `Order processing failed: ${orderProcessingError.message}` });
            }

        } else { // Failed
            await db('mpesa_transactions')
                .where({ id: transaction.id })
                .update({ status: 'Failed', resultDesc: ResultDesc });
        }
        
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    } catch (error) {
        console.error('Error processing M-Pesa callback:', error);
        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Always accept
    }
};

// 3. STATUS CHECK (for frontend polling)
// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getStatus = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.params by using the full express.Request type.
    const { checkoutId } = req.params;
    try {
        const transaction = await db('mpesa_transactions').where({ checkoutRequestId: checkoutId }).first();
        if (!transaction) {
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        if (transaction.status === 'Completed') {
            if (transaction.saleId) {
                const sale = await db('sales').where('sales.id', transaction.saleId).first();
                const items = await db('sale_items')
                    .select('sale_items.*', 'products.partNumber', 'products.name as productName')
                    .leftJoin('products', 'sale_items.productId', 'products.id')
                    .where({ saleId: transaction.saleId });
                const customer = await db('customers').where({ id: sale.customerId }).first();
                const branch = await db('branches').where({ id: sale.branchId }).first();

                // FIX: Correctly access res.status by using the full express.Response type.
                return res.status(200).json({ status: 'Completed', sale: { ...sale, items, customer, branch } });
            }
            // FIX: Correctly access res.status by using the full express.Response type.
            return res.status(200).json({ status: 'Completed' });
        }

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ status: transaction.status, message: transaction.resultDesc });

    } catch (error) {
        next(error);
    }
};

// 4. GET TRANSACTION LOGS
// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    try {
        const query = db('mpesa_transactions')
            .leftJoin('sales', 'mpesa_transactions.saleId', 'sales.id')
            .leftJoin('invoices', 'mpesa_transactions.invoiceId', 'invoices.id')
            .select('mpesa_transactions.*', 'sales.saleNo', 'invoices.invoiceNo');
            
        if (status && status !== 'All') {
            query.where('mpesa_transactions.status', status);
        }

        const totalQuery = query.clone().clearSelect().count('* as total').first();
        const dataQuery = query.orderBy('mpesa_transactions.createdAt', 'desc').limit(limit).offset(offset);

        const [totalResult, transactions] = await Promise.all([totalQuery, dataQuery]);

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json({ transactions, total: totalResult ? Number((totalResult as any).total) : 0 });
    } catch (error) {
        next(error);
    }
};


// FIX: Update permission check to use `hasOneOfPermissions`, allowing users with either
// `USE_POS` (for point-of-sale) or `USE_B2B_PORTAL` (for stock request payments)
// to access this endpoint. This resolves a "Forbidden" error for B2B clients.
router.post('/initiate', isAuthenticated, hasOneOfPermissions([PERMISSIONS.USE_POS, PERMISSIONS.USE_B2B_PORTAL]), initiatePayment);
router.post('/callback', mpesaCallback);
router.get('/status/:checkoutId', isAuthenticated, getStatus);
router.get('/transactions', isAuthenticated, hasPermission(PERMISSIONS.VIEW_MPESA_LOGS), getTransactions);

// FIX: Add missing default export for the router.
export default router;