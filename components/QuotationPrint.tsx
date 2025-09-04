import React from 'react';
// FIX: Explicitly add file extension to assist module resolver.
import { Quotation } from '../types.ts';

interface QuotationPrintProps {
  quotation: Quotation | null;
  isPreview?: boolean;
}

const MasumaLogoBlack = () => (
     <svg width="150" height="50" viewBox="0 0 162 43" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
        <path d="M29.5391 3.51367L19.4932 26.248L9.44727 3.51367H0.939453V42.5H8.32422V14.6309L16.2051 33.7285H22.7832L30.6641 14.6309V42.5H38.0488V3.51367H29.5391Z" fill="currentColor"/>
        <path d="M64.7175 3.51367H48.4206V42.5H55.8054V25.2793H64.0906C71.321 25.2793 75.321 20.6533 75.321 14.3965C75.321 8.13965 71.321 3.51367 64.0906 3.51367H64.7175ZM64.0906 18.5723H55.8054V10.2207H64.0906C67.3181 10.2207 68.6413 11.959 68.6413 14.3965C68.6413 16.834 67.3181 18.5723 64.0906 18.5723Z" fill="currentColor"/>
    </svg>
);

const QuotationPrint: React.FC<QuotationPrintProps> = ({ quotation, isPreview = false }) => {
    if (!quotation) return null;

    const containerClasses = isPreview ? "bg-white text-black p-8 font-sans w-full" : "print-area a4-page";

    return (
        <div className={containerClasses}>
            <div className="bg-white text-black p-4 font-sans">
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b-2 border-black">
                    <div>
                        <MasumaLogoBlack />
                        <p className="text-sm font-bold mt-2">{quotation.branch?.name}</p>
                        <p className="text-xs">{quotation.branch?.address}</p>
                        <p className="text-xs">{quotation.branch?.phone}</p>
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
                
                {/* Totals */}
                <div className="flex justify-end mt-4">
                    <div className="w-1/3 space-y-2">
                        <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-2">
                            <span>Total (KES):</span> 
                            <span>{(quotation.amount || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-600 mt-12 pt-4 border-t border-gray-300">
                    <p>Prices are valid until the expiry date shown above.</p>
                    <p>Thank you for your interest!</p>
                </div>

            </div>
        </div>
    );
};

export default QuotationPrint;