import React from 'react';
import { Sale } from '../types';

interface ReceiptPrintProps {
  sale: Sale | null;
}

const MasumaLogoBlack = () => (
     <svg width="150" height="50" viewBox="0 0 162 43" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
        <path d="M29.5391 3.51367L19.4932 26.248L9.44727 3.51367H0.939453V42.5H8.32422V14.6309L16.2051 33.7285H22.7832L30.6641 14.6309V42.5H38.0488V3.51367H29.5391Z" fill="currentColor"/>
        <path d="M64.7175 3.51367H48.4206V42.5H55.8054V25.2793H64.0906C71.321 25.2793 75.321 20.6533 75.321 14.3965C75.321 8.13965 71.321 3.51367 64.0906 3.51367H64.7175ZM64.0906 18.5723H55.8054V10.2207H64.0906C67.3181 10.2207 68.6413 11.959 68.6413 14.3965C68.6413 16.834 67.3181 18.5723 64.0906 18.5723Z" fill="currentColor"/>
    </svg>
);


const ReceiptPrint: React.FC<ReceiptPrintProps> = ({ sale }) => {
    if (!sale) return null;

    const subtotal = (sale.items && Array.isArray(sale.items))
        ? sale.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
        : 0;
    const discount = subtotal + (sale.tax_amount || 0) - (sale.amount || 0);

    return (
        <div className="print-area hidden">
            <style>{`
                @media print {
                    @page {
                        size: 80mm auto; /* Common thermal printer width */
                        margin: 2mm;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 10pt;
                        color: #000;
                        background: #fff;
                    }
                    .receipt-container {
                        width: 100%;
                    }
                    .no-print { display: none !important; }
                    .print-area { display: block !important; }
                }
            `}</style>
            <div className="receipt-container bg-white text-black p-2 font-mono text-xs">
                <div className="text-center space-y-1 mb-4">
                    <MasumaLogoBlack />
                    <p className="font-semibold">{sale.branch?.name}</p>
                    <p>{sale.branch?.address}</p>
                    <p>Phone: {sale.branch?.phone}</p>
                    <p className="font-bold text-lg pt-2">SALE RECEIPT</p>
                </div>

                <div className="border-t border-b border-dashed border-black py-1 space-y-0.5">
                    <div className="flex justify-between">
                        <span>Receipt No:</span>
                        <span>{sale.sale_no}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{new Date(sale.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Customer:</span>
                        <span>{sale.customer?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Payment:</span>
                        <span className="font-semibold">{sale.payment_method || 'N/A'}</span>
                    </div>
                </div>

                <table className="w-full my-2">
                    <thead>
                        <tr className="border-b border-dashed border-black">
                            <th className="text-left font-semibold">Item</th>
                            <th className="text-center font-semibold">Qty</th>
                            <th className="text-right font-semibold">Price</th>
                            <th className="text-right font-semibold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items && Array.isArray(sale.items) && sale.items.map(item => (
                            <React.Fragment key={item.id}>
                                <tr>
                                    <td colSpan={4} className="text-left pt-1">{item.product_name} ({item.part_number})</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td className="text-center">{item.quantity}</td>
                                    <td className="text-right">{item.unit_price.toFixed(2)}</td>
                                    <td className="text-right">{(item.quantity * item.unit_price).toFixed(2)}</td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                
                <div className="border-t border-dashed border-black pt-2 space-y-1">
                     <div className="flex justify-between">
                        <span className="font-semibold">Subtotal:</span>
                        <span className="font-semibold">{subtotal.toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>{discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Tax (16%):</span>
                        <span>{(sale.tax_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t border-dashed border-black mt-1 pt-1">
                        <span>TOTAL (KES):</span>
                        <span>{(sale.amount || 0).toFixed(2)}</span>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <p className="font-semibold">Thank you for your business!</p>
                    <p>Masuma - Guaranteed Fit, Guaranteed Life.</p>
                </div>
            </div>
        </div>
    );
};

export default ReceiptPrint;