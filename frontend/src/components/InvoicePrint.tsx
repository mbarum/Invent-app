import React from 'react';
import { Invoice, AppSettings } from '@masuma-ea/types';
import Logo from './Logo';

interface InvoicePrintProps {
  invoice: Invoice | null;
  appSettings: Partial<AppSettings>;
  isPreview?: boolean;
  format?: 'a4' | 'thermal';
}

const InvoicePrint: React.FC<InvoicePrintProps> = ({ invoice, appSettings, isPreview = false, format = 'a4' }) => {
    if (!invoice) return null;
    
    const subtotal = (invoice.items || []).reduce((sum, item) => sum + (Number(item.unitPrice || 0) * item.quantity), 0);
    const taxAmount = (Number(invoice.totalAmount) || 0) - subtotal; 

    const containerClasses = isPreview 
        ? "bg-white text-black p-8 font-sans w-full" 
        : `print-area ${format === 'a4' ? 'a4-page' : 'thermal-page'}`;
    
    const contentClasses = format === 'thermal' 
        ? 'w-[70mm] mx-auto bg-white text-black p-2 font-sans text-xs'
        : 'bg-white text-black p-4 font-sans';

    return (
        <div className={containerClasses}>
            <div className={contentClasses}>
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b-2 border-black">
                    <div>
                        <Logo className="w-48 h-auto" />
                        <p className="text-sm font-bold mt-2">{appSettings.companyName || 'Masuma Autoparts East Africa LTD'}</p>
                        <p className="text-xs">{appSettings.companyAddress || invoice.branch?.address}</p>
                        <p className="text-xs">{appSettings.companyPhone || invoice.branch?.phone}</p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-4xl font-bold uppercase">Invoice</h1>
                        <p className="text-sm mt-2"><b>Invoice #:</b> {invoice.invoiceNo}</p>
                        <p className="text-sm"><b>Date:</b> {new Date(invoice.createdAt).toLocaleDateString()}</p>
                        <p className="text-sm"><b>Due Date:</b> {new Date(invoice.dueDate).toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Bill To */}
                <div className="py-4">
                    <p className="font-bold text-sm uppercase">Bill To:</p>
                    <p className="font-semibold text-lg">{invoice.customer?.name}</p>
                    <p className="text-sm">{invoice.customer?.address}</p>
                    <p className="text-sm">{invoice.customer?.phone}</p>
                </div>

                {/* Items Table */}
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-2 border-b-2 border-black font-bold">Part Number</th>
                            <th className="p-2 border-b-2 border-black font-bold">Description</th>
                            <th className="p-2 border-b-2 border-black font-bold text-center">Qty</th>
                            <th className="p-2 border-b-2 border-black font-bold text-right">Unit Price</th>
                            <th className="p-2 border-b-2 border-black font-bold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(invoice.items || []).map(item => (
                            <tr key={item.id} className="border-b border-gray-300">
                                <td className="p-2 font-mono">{item.partNumber}</td>
                                <td className="p-2">{item.productName}</td>
                                <td className="p-2 text-center">{item.quantity}</td>
                                <td className="p-2 text-right">{(Number(item.unitPrice) || 0).toFixed(2)}</td>
                                <td className="p-2 text-right">{(item.quantity * Number(item.unitPrice || 0)).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {/* Totals Section */}
                <div className="flex justify-end mt-4">
                    <div className="w-full sm:w-1/2 md:w-1/3 space-y-2">
                        <div className="flex justify-between"><span>Subtotal:</span> <span>{subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>VAT (16%):</span> <span>{taxAmount > 0 ? taxAmount.toFixed(2) : '0.00'}</span></div>
                        <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-2"><span>Total (KES):</span> <span>{(Number(invoice.totalAmount) || 0).toFixed(2)}</span></div>
                    </div>
                </div>

                {/* Payment Info & Terms Section */}
                <div className="mt-6 text-xs border-t border-gray-300 pt-4">
                    <div className={format === 'a4' ? 'grid grid-cols-2 gap-8' : 'space-y-4'}>
                        {appSettings.paymentDetails && (
                            <div>
                                <h4 className="font-bold uppercase border-b border-black mb-1">Payment Details</h4>
                                <p className="font-sans whitespace-pre-wrap">{appSettings.paymentDetails}</p>
                            </div>
                        )}
                        {appSettings.paymentTerms && (
                             <div>
                                <h4 className="font-bold uppercase border-b border-black mb-1">Terms & Conditions</h4>
                                <p>{appSettings.paymentTerms}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-600 mt-12 pt-4 border-t border-gray-300">
                    <p>If you have any questions about this invoice, please contact us.</p>
                    <p className="font-semibold mt-1">Genuine Masuma Parts – Quality You Can Trust</p>
                </div>

            </div>
        </div>
    );
};

export default InvoicePrint;