
import React from 'react';
import { ShippingLabel } from '@masuma-ea/types';

interface ShippingLabelPrintProps {
  label: ShippingLabel | null;
  format: 'thermal' | 'a5';
}

const QrCodePlaceholder = () => (
    <svg viewBox="0 0 100 100" className="w-24 h-24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#000" d="M0 0h30v30H0z M10 10h10v10H10z M70 0h30v30H70z M80 10h10v10H80z M0 70h30v30H0z M10 80h10v10H10z M40 0h10v10H40z M60 0h10v10H60z M40 20h10v10H40z M0 40h10v10H0z M20 40h10v10H20z M40 40h10v10H40z M0 60h10v10H0z M40 60h10v10H40z M70 40h10v10H70z M90 40h10v10H90z M70 60h10v10H70z M40 70h10v10H40z M60 70h30v10H60z M70 90h30v10H70z M40 90h10v10H40z"/>
    </svg>
);


const ShippingLabelPrint: React.FC<ShippingLabelPrintProps> = ({ label, format }) => {
  if (!label) return null;

  const orderRef = label.sale_id ? `SALE-${String(label.sale_id).padStart(5, '0')}` : `INV-${String(label.invoice_id).padStart(5, '0')}`;

  return (
    <div className={`print-area hidden ${format === 'a5' ? 'a5-page' : ''}`}>
      <div className="bg-white text-black p-4 border border-black flex flex-col font-sans h-full">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b-2 border-black">
          <div>
            
            <p className="text-xs font-semibold pt-4">Masuma Autoparts East Africa LTD</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm">SHIPPING LABEL</p>
            <p className="text-xs">Date: {new Date(label.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Addresses */}
        <div className="flex-1 grid grid-cols-2 gap-4 py-4 border-b-2 border-black">
          <div>
            <p className="text-xs uppercase font-bold">FROM:</p>
            <p className="text-lg font-bold">{label.from_name}</p>
            <p className="text-sm">{label.from_address}</p>
            <p className="text-sm">Phone: {label.from_phone}</p>
          </div>
          <div className="border-l-2 border-black pl-4">
            <p className="text-xs uppercase font-bold">TO:</p>
            <p className="text-xl font-bold">{label.to_name}</p>
            <p className="text-base">{label.to_address}</p>
            <p className="text-base">Phone: {label.to_phone}</p>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-3 gap-4 py-2 border-b-2 border-black">
          <div>
            <p className="text-xs uppercase">Order Ref:</p>
            <p className="font-bold text-lg">{orderRef}</p>
          </div>
          <div>
            <p className="text-xs uppercase">Carrier:</p>
            <p className="font-bold text-lg">{label.carrier || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs uppercase">Weight:</p>
            <p className="font-bold text-lg">{label.weight ? `${label.weight} kg` : 'N/A'}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4">
          <div className="text-center">
             <QrCodePlaceholder />
             <p className="text-xs tracking-widest font-mono">{label.id}</p>
          </div>
          <div className="text-center">
            {/* Barcode Placeholder */}
            <svg height="50" width="200" className="mx-auto">
              <rect x="10" y="10" width="2" height="30" fill="black" />
              <rect x="15" y="10" width="1" height="30" fill="black" />
              <rect x="18" y="10" width="3" height="30" fill="black" />
              <rect x="23" y="10" width="1" height="30" fill="black" />
              <rect x="26" y="10" width="2" height="30" fill="black" />
              <rect x="30" y="10" width="2" height="30" fill="black" />
              <rect x="35" y="10" width="1" height="30" fill="black" />
              <rect x="40" y="10" width="3" height="30" fill="black" />
              <rect x="45" y="10" width="1" height="30" fill="black" />
              <rect x="50" y="10" width="2" height="30" fill="black" />
              <rect x="55" y="10" width="1" height="30" fill="black" />
              <rect x="60" y="10" width="3" height="30" fill="black" />
              <rect x="65" y="10" width="2" height="30" fill="black" />
              <rect x="70" y="10" width="1" height="30" fill="black" />
              <rect x="75" y="10" width="3" height="30" fill="black" />
              <rect x="80" y="10" width="2" height="30" fill="black" />
              <rect x="85" y="10" width="1" height="30" fill="black" />
              <rect x="90" y="10" width="3" height="30" fill="black" />
            </svg>
            <p className="text-xs tracking-widest font-mono">{orderRef}</p>
          </div>
        </div>
        <p className="text-center text-xs text-gray-800 mt-2 pt-2 border-t border-dashed border-gray-400">
            Genuine Masuma Parts – Quality You Can Trust
        </p>
      </div>
    </div>
  );
};

export default ShippingLabelPrint;