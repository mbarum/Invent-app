

/// <reference types="node" />

import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import db from '../db';
import { createSaleInTransaction } from './posController';
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

const getMpesaToken = async () => {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    const url = process.env.MPESA_ENV === 'live'
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    const response = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    return response.data.access_token;
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const initiateStkPush = async (req: Request, res: Response, next: NextFunction) => {
    const { amount, phoneNumber, ...saleData } = req.body;
    
    try {
        const token = await getMpesaToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const shortcode = process.env.MPESA_PAYBILL;
        const passkey = process.env.MPESA_PASSKEY;
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

        const url = process.env.MPESA_ENV === 'live'
            ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
            : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

        const stkBody = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount), // M-Pesa requires an integer
            PartyA: phoneNumber,
            PartyB: shortcode,
            PhoneNumber: phoneNumber,
            CallBackURL: `${process.env.BACKEND_URL}/api/mpesa/stk-callback`,
            AccountReference: saleData.invoiceId ? `INV-${saleData.invoiceId}` : 'POS Sale',
            TransactionDesc: 'Payment for goods'
        };

        const response = await axios.post(url, stkBody, { headers: { Authorization: `Bearer ${token}` } });
        
        const { MerchantRequestID, CheckoutRequestID, ResponseCode } = response.data;
        
        if (ResponseCode === '0') {
            await db('mpesa_transactions').insert({
                checkoutRequestId: CheckoutRequestID,
                merchantRequestId: MerchantRequestID,
                amount,
                phoneNumber,
                invoiceId: saleData.invoiceId,
                status: 'Pending',
                transactionDetails: JSON.stringify(saleData)
            });
            res.status(200).json({ checkoutRequestId: CheckoutRequestID });
        } else {
            throw new Error('Failed to initiate STK push.');
        }

    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const stkCallback = async (req: Request, res: Response) => {
    const callbackData = req.body.Body.stkCallback;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

    try {
        if (ResultCode === 0) {
            // Success
            const amountItem = CallbackMetadata.Item.find((i: any) => i.Name === 'Amount');
            const receiptItem = CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber');
            
            const transaction = await db('mpesa_transactions').where({ checkoutRequestId: CheckoutRequestID }).first();
            if (transaction && transaction.status === 'Pending') {
                 const salePayload = JSON.parse(transaction.transactionDetails);
                 const sale = await createSaleInTransaction(salePayload);

                 await db('mpesa_transactions').where({ checkoutRequestId: CheckoutRequestID }).update({
                    status: 'Completed',
                    resultDesc: ResultDesc,
                    mpesaReceiptNumber: receiptItem.Value,
                    saleId: sale.id
                 });
            }
        } else {
            // Failure
            await db('mpesa_transactions').where({ checkoutRequestId: CheckoutRequestID }).update({
                status: 'Failed',
                resultDesc: ResultDesc,
            });
        }
    } catch (error) {
        console.error("STK Callback processing error:", error);
    }
    
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
    const { checkoutRequestId } = req.params;
    try {
        const transaction = await db('mpesa_transactions').where({ checkoutRequestId }).first();
        if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });

        if (transaction.status === 'Completed') {
            const sale = await db('sales').where({ id: transaction.saleId }).first();
            return res.status(200).json({ status: 'Completed', sale });
        }

        if (transaction.status === 'Failed') {
            return res.status(200).json({ status: 'Failed', message: transaction.resultDesc });
        }
        
        res.status(200).json({ status: 'Pending' });

    } catch (error) {
        next(error);
    }
};

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 15, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        const query = db('mpesa_transactions')
            .leftJoin('sales', 'mpesa_transactions.saleId', 'sales.id')
            .leftJoin('invoices', 'mpesa_transactions.invoiceId', 'invoices.id')
            .select('mpesa_transactions.*', 'sales.saleNo', 'invoices.invoiceNo')
            .orderBy('mpesa_transactions.createdAt', 'desc');

        if (status && status !== 'All') {
            query.where('mpesa_transactions.status', status as string);
        }

        const totalQuery = query.clone().clearSelect().count('* as total').first();
        const dataQuery = query.limit(Number(limit)).offset(offset);

        const [totalResult, transactions] = await Promise.all([totalQuery, dataQuery]);

        res.status(200).json({ transactions, total: totalResult ? Number((totalResult as any).total) : 0 });

    } catch (error) {
        next(error);
    }
};


router.post('/stk-push', isAuthenticated, hasPermission(PERMISSIONS.USE_POS), initiateStkPush);
router.post('/stk-callback', stkCallback); // Publicly accessible for Safaricom
router.get('/payment-status/:checkoutRequestId', isAuthenticated, getPaymentStatus);
router.get('/transactions', isAuthenticated, hasPermission(PERMISSIONS.VIEW_MPESA_LOGS), getTransactions);

export default router;