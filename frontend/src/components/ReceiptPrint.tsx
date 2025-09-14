import React from 'react';
import { Sale } from '@masuma-ea/types';

interface ReceiptPrintProps {
  sale: Sale | null;
}

const ReceiptPrint: React.FC<ReceiptPrintProps> = ({ sale }) => {
  if (!sale) return null;

  const subtotal = Array.isArray(sale.items) ? sale.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) : 0;

  return (
    <div className="bg-white text-black p-4 font-mono text-xs w-[300px] mx-auto">
        
        <p className="text-center font-bold text-base pt-4 mb-2">Sales Receipt</p>

        <div className="text-center">
            <p className="font-semibold">Masuma Autoparts East Africa LTD</p>
            <p>{sale.branch?.name}</p>
            <p>{sale.branch?.address}</p>
            <p>Phone: {sale.branch?.phone}</p>
        </div>
        <hr className="my-2 border-black border-dashed"/>
        <p>Sale No: {sale.sale_no}</p>
        <p>Date: {new Date(sale.created_at).toLocaleString()}</p>
        <p>Customer: {sale.customer?.name}</p>
        <hr className="my-2 border-black border-dashed"/>
        <table className="w-full">
            <thead><tr><th className="text-left">Item</th><th className="text-center">Qty</th><th className="text-right">Total</th></tr></thead>
            <tbody>
                {Array.isArray(sale.items) && sale.items.map(item => (
                    <tr key={item.id}>
                        <td className="text-left">{item.product_name}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">{(item.unit_price * item.quantity).toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <hr className="my-2 border-black border-dashed"/>
        <p className="flex justify-between"><span>Subtotal:</span> <span>{subtotal.toFixed(2)}</span></p>
        {(sale.discount_amount || 0) > 0 && (
            <p className="flex justify-between"><span>Discount:</span> <span>-{(sale.discount_amount || 0).toFixed(2)}</span></p>
        )}
        <p className="flex justify-between"><span>VAT (16%):</span> <span>{(sale.tax_amount || 0).toFixed(2)}</span></p>
        <p className="flex justify-between font-bold"><span>TOTAL:</span> <span>{sale.totalAmount.toFixed(2)}</span></p>
        <hr className="my-2 border-black border-dashed"/>
        <p>Paid via: {sale.payment_method}</p>
        <p className="text-center mt-4 font-semibold">Thank you for choosing Masuma Autospares</p>
    </div>
  );
};

export default ReceiptPrint;