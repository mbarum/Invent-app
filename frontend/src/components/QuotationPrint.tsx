
import React from 'react';
import { Quotation, AppSettings } from '@masuma-ea/types';

interface QuotationPrintProps {
  quotation: Quotation | null;
  appSettings: Partial<AppSettings>;
  isPreview?: boolean;
}

const QuotationPrint: React.FC<QuotationPrintProps> = ({ quotation, appSettings, isPreview = false }) => {
    if (!quotation) return null;

    const containerClasses = isPreview ? "bg-white text-black p-8 font-sans w-full" : "print-area a4-page";

    return (
        <div className={containerClasses}>
             <div className="bg-white text-black p-4 font-sans">
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b-2 border-black">
                    <div>
                        
                        <p className="text-sm font-bold mt-2">{appSettings.companyName || 'Masuma Autoparts East Africa LTD'}</p>
                        <p className="text-xs">{appSettings.companyAddress || quotation.branch?.address}</p>
                        <p className="text-xs">{appSettings.companyPhone || quotation.branch?.phone}</p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-4xl font-bold uppercase">Quotation</h1>
                        <p className="text-sm mt-2"><b>Quote #:</b> {quotation.quotation_no}</p>
                        <p className="text-sm"><b>Date:</b> {new Date(quotation.created_at).toLocaleDateString()}</p>
                        <p className="text-sm"><b>Valid Until:</b> {new Date(quotation.valid_until).toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Bill To */}
                <div className="py-4">
                    <p className="font-bold text-sm uppercase">Prepared For:</p>
                    <p className="font-semibold text-lg">{quotation.customer?.name}</p>
                    <p className="text-sm">{quotation.customer?.address}</p>
                    <p className="text-sm">{quotation.customer?.phone}</p>
                </div>

                {/* Items Table */}
                <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-gray-200"><th className="p-2 border-b-2 border-black font-bold">Part Number</th><th className="p-2 border-b-2 border-black font-bold">Description</th><th className="p-2 border-b-2 border-black font-bold text-center">Qty</th><th className="p-2 border-b-2 border-black font-bold text-right">Unit Price</th><th className="p-2 border-b-2 border-black font-bold text-right">Total</th></tr></thead>
                    <tbody>
                        {(quotation.items || []).map(item => (
                            <tr key={item.id} className="border-b border-gray-300">
                                <td className="p-2 font-mono">{item.part_number}</td>
                                <td className="p-2">{item.product_name}</td>
                                <td className="p-2 text-center">{item.quantity}</td>
                                <td className="p-2 text-right">{item.unit_price.toFixed(2)}</td>
                                <td className="p-2 text-right">{(item.quantity * item.unit_price).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                 {/* Totals & Payment Info */}
                <div className="flex justify-between items-start mt-4">
                    <div className="w-2/3 text-xs">
                        {appSettings.paymentDetails && (
                            <div className="mb-4">
                                <h4 className="font-bold uppercase border-b border-black mb-1">Payment Details</h4>
                                <pre className="font-sans whitespace-pre-wrap">{appSettings.paymentDetails}</pre>
                            </div>
                        )}
                         {appSettings.paymentTerms && (
                             <div>
                                <h4 className="font-bold uppercase border-b border-black mb-1">Terms & Conditions</h4>
                                <p>{appSettings.paymentTerms}</p>
                            </div>
                        )}
                    </div>
                    <div className="w-1/3 space-y-2">
                        <div className="flex justify-end">
                            <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-2 w-full">
                                <span>Total (KES):</span> <span>{(quotation.amount || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Footer */}
                <div className="text-center text-xs text-gray-600 mt-12 pt-4 border-t border-gray-300">
                    <p>Prices are valid until the date shown above.</p>
                     <p className="font-semibold mt-1">Genuine Masuma Parts – Quality You Can Trust</p>
                </div>
            </div>
        </div>
    );
};

export default QuotationPrint;