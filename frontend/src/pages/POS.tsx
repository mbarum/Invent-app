import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
// FIX: Remove .tsx and .ts file extensions from imports for proper module resolution.
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { Product, Customer, Branch, Invoice, InvoiceStatus, Sale } from '@masuma-ea/types';
import { createSale, getInvoices, getInvoiceDetails, initiateMpesaPayment, getMpesaPaymentStatus, createCustomer } from '../services/api';
import { User, Search, X, Plus, Minus, Printer, LoaderCircle, FileText, Ban, Download, CheckCircle, XCircle, UserPlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import ReceiptPrint from '../components/ReceiptPrint';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDataStore } from '../store/dataStore';

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

interface CartItem {
    product: Product;
    quantity: number;
}

const POS: React.FC = () => {
    const { currentBranch, currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const { products: allProducts, customers: allCustomers, isInitialDataLoaded, refetchProducts, refetchSales, refetchCustomers } = useDataStore();

    // Data state
    const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);

    // Sale state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [applyTax, setApplyTax] = useState(true);
    const [payingForInvoice, setPayingForInvoice] = useState<Invoice | null>(null);

    // UI state
    const [isProcessing, setIsProcessing] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '', address: '', kraPin: '' });

    // M-Pesa state
    const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
    const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
    const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'waiting' | 'success' | 'failed'>('idle');
    const [mpesaCheckoutId, setMpesaCheckoutId] = useState<string | null>(null);
    const [mpesaError, setMpesaError] = useState<string | null>(null);

    // Refs for keyboard shortcuts
    const customerSearchRef = useRef<HTMLInputElement>(null);
    const productSearchRef = useRef<HTMLInputElement>(null);
    const paymentMethodRef = useRef<HTMLSelectElement>(null);
    const completeSaleBtnRef = useRef<HTMLButtonElement>(null);


    useEffect(() => {
        const fetchInvoicesData = async () => {
            try {
                const invoicesData = await getInvoices(InvoiceStatus.UNPAID);
                setUnpaidInvoices(invoicesData);
            } catch (error) {
                toast.error('Failed to load unpaid invoices.');
            }
        };
        fetchInvoicesData();
    }, []);
    
    // M-Pesa Polling Effect
    useEffect(() => {
        if (mpesaStatus !== 'waiting' || !mpesaCheckoutId) return;

        const interval = setInterval(async () => {
            try {
                const { status, sale, message } = await getMpesaPaymentStatus(mpesaCheckoutId);
                if (status === 'Completed' && sale) {
                    setMpesaStatus('success');
                    setCompletedSale(sale);
                    refetchProducts(); // Update stock
                    refetchSales(); // Update sales list
                    if(payingForInvoice) {
                        setUnpaidInvoices(prev => prev.filter(i => i.id !== payingForInvoice.id));
                    }
                    clearInterval(interval);
                } else if (status === 'Failed') {
                    setMpesaStatus('failed');
                    setMpesaError(message || 'Payment failed or was cancelled by user.');
                    clearInterval(interval);
                }
            } catch (err) { console.error("Polling error:", err); }
        }, 5000); // Poll every 5 seconds

        const timeout = setTimeout(() => {
            clearInterval(interval);
            if (mpesaStatus === 'waiting') {
                setMpesaStatus('failed');
                setMpesaError('Payment timed out. Please try again.');
            }
        }, 120000); // 2 minute timeout

        return () => { clearInterval(interval); clearTimeout(timeout); };
    }, [mpesaStatus, mpesaCheckoutId, payingForInvoice, refetchProducts, refetchSales]);
    
    // Keyboard shortcuts effect
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isMpesaModalOpen || !!completedSale || isCustomerModalOpen) return;

            if (e.ctrlKey && e.key.toLowerCase() === 'i') { e.preventDefault(); productSearchRef.current?.focus(); }
            if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); customerSearchRef.current?.focus(); }
            if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); paymentMethodRef.current?.focus(); }
            if (e.key === 'F10') { e.preventDefault(); completeSaleBtnRef.current?.click(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMpesaModalOpen, completedSale, isCustomerModalOpen]);


    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        const convertedAmount = amount * rate;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currentCurrency,
        }).format(convertedAmount);
    };

    const productSearchResults = useMemo(() => {
        if (!productSearch) return [];
        const lowercasedTerm = productSearch.toLowerCase();
        return allProducts.filter(p =>
            (p.partNumber || '').toLowerCase().includes(lowercasedTerm) ||
            (p.name || '').toLowerCase().includes(lowercasedTerm)
        ).slice(0, 10);
    }, [productSearch, allProducts]);

    const customerSearchResults = useMemo(() => {
        if (!customerSearch) return [];
        const lowercasedTerm = customerSearch.toLowerCase();
        return allCustomers.filter(c =>
            (c.name || '').toLowerCase().includes(lowercasedTerm) ||
            (c.phone || '').toLowerCase().includes(lowercasedTerm)
        ).slice(0, 5);
    }, [customerSearch, allCustomers]);
    
    const addToCart = (product: Product) => {
        if (payingForInvoice) {
            toast.error("Cannot add products while paying for an invoice.");
            return;
        }
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.product.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < product.stock) {
                   return prevCart.map(item =>
                        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                    );
                } else {
                    toast.error(`Cannot add more. Stock limit for ${product.name} is ${product.stock}.`);
                    return prevCart;
                }
            }
            if (product.stock > 0) {
              return [...prevCart, { product, quantity: 1 }];
            } else {
              toast.error(`${product.name} is out of stock.`);
              return prevCart;
            }
        });
        setProductSearch('');
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        if (payingForInvoice) {
            toast.error("Cannot modify cart while paying for an invoice.");
            return;
        }
        setCart(prevCart => {
            const itemToUpdate = prevCart.find(item => item.product.id === productId);
            if (itemToUpdate && newQuantity > itemToUpdate.product.stock) {
                toast.error(`Stock limit for ${itemToUpdate.product.name} is ${itemToUpdate.product.stock}.`);
                return prevCart;
            }
             if (newQuantity < 1) {
                return prevCart.filter(item => item.product.id !== productId);
            }
            return prevCart.map(item =>
                item.product.id === productId ? { ...item, quantity: newQuantity } : item
            );
        });
    };
    
    const removeFromCart = (productId: string) => {
        if (payingForInvoice) {
            toast.error("Cannot modify cart while paying for an invoice.");
            return;
        }
        setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
    };

    const selectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerSearch('');
        setMpesaPhoneNumber(customer.phone?.replace(/[^0-9]/g, '').slice(-9) || '');
    };

    const { subtotal, discountAmount, taxAmount, total } = useMemo(() => {
        const TAX_RATE = 0.16;
        const sub = cart.reduce((acc, item) => acc + Number(item.product.retailPrice) * item.quantity, 0);
        let disc = 0;
        if (!payingForInvoice) {
            if (discountType === 'percent') {
                disc = sub * (discount / 100);
            } else {
                disc = discount;
            }
        }
        const subtotalAfterDiscount = sub - disc;
        const tax = applyTax ? subtotalAfterDiscount * TAX_RATE : 0;
        const tot = subtotalAfterDiscount + tax;

        return { subtotal: sub, discountAmount: disc, taxAmount: tax, total: tot };
    }, [cart, discount, discountType, applyTax, payingForInvoice]);
    
    const resetSale = () => {
        setCart([]);
        setSelectedCustomer(null);
        setDiscount(0);
        setDiscountType('fixed');
        setPaymentMethod('Cash');
        setApplyTax(true);
        setPayingForInvoice(null);
        setCompletedSale(null);
    };
    
    const handleSelectInvoice = async (invoice: Invoice) => {
        try {
            const detailedInvoice = await getInvoiceDetails(invoice.id);
            const customer = allCustomers.find(c => c.id === detailedInvoice.customerId);
            if(customer) selectCustomer(customer);

            const cartItems: CartItem[] = (detailedInvoice.items || []).map(item => ({
                product: {
                    id: item.productId, partNumber: item.partNumber || 'N/A', name: item.productName || 'Unknown',
                    retailPrice: item.unitPrice, wholesalePrice: item.unitPrice, stock: item.quantity
                },
                quantity: item.quantity,
            }));
            setCart(cartItems);
            setPayingForInvoice(detailedInvoice);
            toast.success(`Loaded invoice ${detailedInvoice.invoiceNo}. Cart is now locked.`);

        } catch (err) {
            toast.error("Failed to load invoice details.");
        }
    }
    
    const handleInitiateSale = () => {
        if (!selectedCustomer) { toast.error("Please select a customer."); return; }
        if (cart.length === 0) { toast.error("Cart is empty."); return; }
        if (paymentMethod === 'MPESA') {
            setMpesaStatus('idle'); setMpesaError(null); setIsMpesaModalOpen(true);
        } else {
            completeNonMpesaSale();
        }
    };

    const completeNonMpesaSale = async () => {
        setIsProcessing(true);
        try {
            const payload = {
                customerId: selectedCustomer!.id, branchId: currentBranch.id,
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.retailPrice })),
                discountAmount, taxAmount, totalAmount: total, paymentMethod, invoiceId: payingForInvoice?.id
            };
            const saleResult = await createSale(payload);
            setCompletedSale(saleResult);
            toast.success(`Sale ${saleResult.saleNo} completed!`);
            refetchProducts(); refetchSales();
            if(payingForInvoice) { setUnpaidInvoices(prev => prev.filter(i => i.id !== payingForInvoice.id)); }
        } catch (err: any) {
            toast.error(`Failed to complete sale: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleRequestMpesaPayment = async () => {
        if (!mpesaPhoneNumber || !/^\d{9,12}$/.test(mpesaPhoneNumber)) {
            toast.error("Please enter a valid phone number (e.g., 712345678)."); return;
        }
        setMpesaStatus('waiting');
        try {
            const payload = {
                amount: total, phoneNumber: `254${mpesaPhoneNumber.slice(-9)}`,
                // Pass full sale details for backend processing
                customerId: selectedCustomer!.id,
                branchId: currentBranch.id,
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.retailPrice })),
                discountAmount,
                taxAmount,
                totalAmount: total,
                paymentMethod,
                invoiceId: payingForInvoice?.id
            };
            const { checkoutRequestId } = await initiateMpesaPayment(payload);
            setMpesaCheckoutId(checkoutRequestId);
        } catch (err: any) {
            setMpesaStatus('failed'); setMpesaError(err.message || "Failed to initiate payment.");
        }
    };

    const handleAddNewCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newCust = await createCustomer(newCustomerData);
            await refetchCustomers(); // Update global store
            toast.success("Customer added!");
            selectCustomer(newCust);
            setCustomerModalOpen(false);
            setNewCustomerData({ name: '', phone: '', address: '', kraPin: '' });
        } catch (err: any) {
            toast.error(`Failed to add customer: ${err.message}`);
        }
    };
    
    const handleDownloadPdf = async () => {
        const element = document.getElementById('receipt-to-print');
        if (!element || !completedSale) return;
        const toastId = toast.loading('Generating PDF...', { duration: 5000 });
        try {
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: null });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Receipt-${completedSale.saleNo}.pdf`);
            toast.success('PDF downloaded!', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate PDF.', { id: toastId });
        }
    };

    const handlePrintReceipt = () => window.print();

    return (
      <>
        <div className="space-y-4">
            <h1 className="text-3xl font-bold">Point of Sale</h1>
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-150px)]">
                {/* --- LEFT PANE: WORKSPACE --- */}
                <Card className="flex-1 flex flex-col">
                    <CardHeader>
                        {selectedCustomer ? (
                            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                                <div>
                                    <p className="font-semibold text-lg">{selectedCustomer.name}</p>
                                    <p className="text-sm text-gray-400">{selectedCustomer.phone}</p>
                                </div>
                                {!payingForInvoice && (
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4 mr-1"/>Change</Button>
                                )}
                            </div>
                        ) : (
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input ref={customerSearchRef} placeholder="Search Customer (Ctrl+U)" className="pl-10" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} disabled={!isInitialDataLoaded || !!payingForInvoice}/>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <Button variant="ghost" size="sm" onClick={() => setCustomerModalOpen(true)}><UserPlus className="h-4 w-4 mr-1"/> Quick Add</Button>
                                </div>
                                {customerSearchResults.length > 0 && (
                                    <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-30 absolute w-full shadow-lg">{customerSearchResults.map(c => 
                                        <li key={c.id} onClick={() => selectCustomer(c)} className="p-3 hover:bg-gray-700 cursor-pointer text-sm">
                                            <p className="font-semibold">{c.name}</p><p className="text-xs text-gray-400">{c.phone}</p>
                                        </li>)}
                                    </ul>
                                )}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input ref={productSearchRef} placeholder="Scan or Search Product (Ctrl+I)" className="pl-10" value={productSearch} onChange={e => setProductSearch(e.target.value)} disabled={!isInitialDataLoaded || !!payingForInvoice} />
                            {productSearchResults.length > 0 && (
                                <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-20 absolute w-full shadow-lg max-h-80 overflow-y-auto">{productSearchResults.map(p => 
                                    <li key={p.id} onClick={() => addToCart(p)} className="p-3 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm">
                                        <div><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-400 font-mono">{p.partNumber}</p></div>
                                        <div className="text-right"><p className="font-medium">{formatCurrency(p.retailPrice)}</p><p className="text-xs text-gray-500">{p.stock} in stock</p></div>
                                    </li>)}
                                </ul>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto -mx-6 px-6">
                            {cart.length === 0 ? <div className="text-center text-gray-500 pt-16">Cart is empty</div> : 
                                <div className="space-y-2">{cart.map(item => (
                                <div key={item.product.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800/50">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-200">{item.product.name}</p>
                                        <p className="text-xs text-gray-400">{item.quantity} x {formatCurrency(item.product.retailPrice)}</p>
                                    </div>
                                    <div className="flex items-center">
                                        <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} disabled={!!payingForInvoice}><Minus className="h-4 w-4"/></Button>
                                        <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)} className="w-14 text-center h-8 mx-1 p-0" disabled={!!payingForInvoice} />
                                        <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} disabled={!!payingForInvoice}><Plus className="h-4 w-4"/></Button>
                                    </div>
                                    <p className="w-24 text-right font-semibold">{formatCurrency(item.product.retailPrice * item.quantity)}</p>
                                    <Button variant="ghost" size="sm" className="p-1 h-auto text-red-500 hover:text-red-400 ml-2" onClick={() => removeFromCart(item.product.id)} disabled={!!payingForInvoice}><Trash2 className="h-4 w-4"/></Button>
                                </div>))}</div>
                            }
                        </div>
                    </CardContent>
                </Card>
                {/* --- RIGHT PANE: CHECKOUT --- */}
                <div className="w-full lg:w-96 flex-shrink-0">
                    <Card className="sticky top-6">
                        <CardHeader>
                            <CardTitle>Checkout</CardTitle>
                            {payingForInvoice && <CardDescription className="!mt-2 flex items-center gap-2 p-2 rounded-md bg-orange-900/50 text-orange-300 border border-orange-800">
                                <FileText className="h-4 w-4"/> Paying Invoice <b className="font-mono">{payingForInvoice.invoiceNo}</b></CardDescription>}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 text-sm border-b border-gray-700 pb-4 mb-4">
                                <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                                <div className="flex justify-between items-center"><span>Discount</span><div className="flex items-center w-1/2">
                                    <Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="h-8 w-full mr-1" disabled={!!payingForInvoice}/>
                                    <Select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className="h-8" disabled={!!payingForInvoice}>
                                        <option value="fixed">{currentCurrency}</option><option value="percent">%</option></Select>
                                </div></div>
                                <div className="flex justify-between text-red-400"><span>Discount Applied</span><span className="font-medium">-{formatCurrency(discountAmount)}</span></div>
                                <div className="flex justify-between"><div className="flex items-center">
                                    <input id="apply-tax" type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-orange-600 focus:ring-orange-500 focus:ring-offset-gray-800 mr-2" disabled={!!payingForInvoice}/>
                                    <label htmlFor="apply-tax">Apply 16% VAT</label></div><span className="font-medium">{formatCurrency(taxAmount)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between text-2xl font-bold my-4"><span>Total</span><span>{formatCurrency(total)}</span></div>
                            <div className="space-y-4">
                                <Select ref={paymentMethodRef} label="Payment Method (Ctrl+P)" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                    <option>Cash</option><option>MPESA</option><option>Bank Transfer</option><option>Cheque</option></Select>
                                {payingForInvoice && <Button variant="secondary" size="sm" className="w-full" onClick={resetSale}><Ban className="h-4 w-4 mr-2"/> Cancel Invoice Payment</Button>}
                                <Button ref={completeSaleBtnRef} size="lg" className="w-full" onClick={handleInitiateSale} disabled={isProcessing || !selectedCustomer || cart.length === 0}>
                                    {isProcessing ? <LoaderCircle className="animate-spin h-5 w-5 mr-2" /> : null}
                                    {paymentMethod === 'MPESA' ? 'Pay with M-Pesa' : 'Complete Sale (F10)'}
                                </Button>
                                <Button variant="secondary" className="w-full" onClick={() => toast((t) => (
                                    <span>Clear current sale?<Button variant="ghost" size="sm" className="ml-2 text-red-400" onClick={() => {resetSale(); toast.dismiss(t.id);}}>Yes, clear it</Button></span>
                                ))}>Clear Sale</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <Modal isOpen={isMpesaModalOpen} onClose={() => setIsMpesaModalOpen(false)} title="M-Pesa Payment">
             {mpesaStatus === 'idle' && (<div className="space-y-4">
                <CardDescription>Enter customer's phone number to send payment request.</CardDescription>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">+254</span>
                    <Input label="Phone Number (Safaricom)" name="phone" value={mpesaPhoneNumber} onChange={(e) => setMpesaPhoneNumber(e.target.value)} placeholder="712345678" className="pl-14"/>
                </div>
                <p className="text-lg font-bold text-center">Amount: {formatCurrency(total)}</p>
                <Button className="w-full" onClick={handleRequestMpesaPayment}>Request Payment</Button>
            </div>)}
            {mpesaStatus === 'waiting' && (<div className="text-center py-8">
                <LoaderCircle className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
                <p className="font-semibold">STK Push Sent</p>
                <p className="text-gray-400">Waiting for customer to complete transaction...</p>
            </div>)}
            {mpesaStatus === 'success' && (<div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="font-semibold">Payment Successful!</p>
                <p className="text-gray-400">Closing this will show the receipt.</p>
                <Button className="mt-4" onClick={() => setIsMpesaModalOpen(false)}>View Receipt</Button>
            </div>)}
            {mpesaStatus === 'failed' && (<div className="text-center py-8">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="font-semibold">Payment Failed</p>
                <p className="text-gray-400">{mpesaError}</p>
                <div className="flex space-x-2 mt-4 justify-center"><Button variant="secondary" onClick={() => setIsMpesaModalOpen(false)}>Cancel</Button><Button onClick={() => setMpesaStatus('idle')}>Try Again</Button></div>
            </div>)}
        </Modal>

        <Modal isOpen={isCustomerModalOpen} onClose={() => setCustomerModalOpen(false)} title="Quick Add Customer">
            <form onSubmit={handleAddNewCustomer} className="space-y-4">
                <Input label="Full Name" name="name" value={newCustomerData.name} onChange={(e) => setNewCustomerData({...newCustomerData, name: e.target.value})} required />
                <Input label="Phone Number" name="phone" type="tel" value={newCustomerData.phone} onChange={(e) => setNewCustomerData({...newCustomerData, phone: e.target.value})} required />
                <Input label="Address" name="address" value={newCustomerData.address} onChange={(e) => setNewCustomerData({...newCustomerData, address: e.target.value})} />
                <Input label="KRA PIN (Optional)" name="kraPin" value={newCustomerData.kraPin} onChange={(e) => setNewCustomerData({...newCustomerData, kraPin: e.target.value})} />
                <div className="flex justify-end space-x-2 pt-2"><Button variant="secondary" type="button" onClick={() => setCustomerModalOpen(false)}>Cancel</Button><Button type="submit">Save Customer</Button></div>
            </form>
        </Modal>

        {completedSale && (
            <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full animate-in fade-in-0 zoom-in-95">
                    <CardHeader>
                        <CardTitle>Sale Complete: {completedSale.saleNo}</CardTitle>
                        <CardDescription>Print or download the receipt for the customer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex space-x-2 mb-4">
                            <Button onClick={handlePrintReceipt} variant="secondary" className="w-full"><Printer className="mr-2 h-4 w-4" /> Print Receipt</Button>
                            <Button onClick={handleDownloadPdf} className="w-full"><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                        </div>
                         <div id="receipt-to-print" className="border border-gray-700 rounded-md p-2 h-80 overflow-y-auto bg-gray-900">
                             <ReceiptPrint sale={completedSale} />
                        </div>
                        <Button size="lg" className="w-full mt-4" onClick={resetSale}>Start New Sale</Button>
                    </CardContent>
                </Card>
                <div className="hidden print:block"><ReceiptPrint sale={completedSale} /></div>
            </div>
        )}
      </>
    );
};

export default POS;
