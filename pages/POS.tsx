import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Select from '../components/ui/Select';
// FIX: Changed import path for `types` to allow module resolution by removing the file extension.
import { Product, Customer, Branch, Invoice, InvoiceStatus, Sale } from '@masuma-ea/types';
import { getProducts, getCustomers, createSale, getInvoices, getInvoiceDetails, initiateMpesaPayment, getMpesaPaymentStatus } from '../services/api';
// FIX: Import CheckCircle and XCircle icons.
import { User, Search, X, Plus, Minus, Percent, Printer, LoaderCircle, FileText, Ban, Download, Phone, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import ReceiptPrint from '../components/ReceiptPrint';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

    // Data state
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

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
    const [invoiceSearch, setInvoiceSearch] = useState('');

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
        const fetchData = async () => {
            try {
                setIsLoadingData(true);
                const [productsData, customersData, invoicesData] = await Promise.all([
                    getProducts(), 
                    getCustomers(),
                    getInvoices(InvoiceStatus.UNPAID)
                ]);
                setAllProducts(productsData);
                setAllCustomers(customersData);
                setUnpaidInvoices(invoicesData);
            } catch (error) {
                toast.error('Failed to load necessary data.');
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
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
    }, [mpesaStatus, mpesaCheckoutId, payingForInvoice]);
    
    // Keyboard shortcuts effect
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Do not trigger shortcuts if a modal is open
            if (isMpesaModalOpen || !!completedSale) return;

            if (e.ctrlKey && e.key.toLowerCase() === 'i') { // Ctrl+I to focus product search
                e.preventDefault();
                productSearchRef.current?.focus();
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'u') { // Ctrl+U for user/customer search
                e.preventDefault();
                customerSearchRef.current?.focus();
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'p') { // Ctrl+P for payment method
                e.preventDefault();
                paymentMethodRef.current?.focus();
            }
            if (e.key === 'F10') { // F10 to complete sale
                e.preventDefault();
                completeSaleBtnRef.current?.click();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMpesaModalOpen, completedSale]);


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
        return allProducts.filter(p =>
            p.partNumber.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.name.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 5);
    }, [productSearch, allProducts]);

    const customerSearchResults = useMemo(() => {
        if (!customerSearch) return [];
        return allCustomers.filter(c =>
            c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
            c.phone.includes(customerSearch)
        ).slice(0, 5);
    }, [customerSearch, allCustomers]);
    
    const invoiceSearchResults = useMemo(() => {
        if (!invoiceSearch) return [];
        return unpaidInvoices.filter(i =>
            i.invoice_no.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
            i.customerName?.toLowerCase().includes(invoiceSearch.toLowerCase())
        ).slice(0, 5);
    }, [invoiceSearch, unpaidInvoices]);

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
            return [...prevCart, { product, quantity: 1 }];
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
        setMpesaPhoneNumber(customer.phone.replace(/[^0-9]/g, '').slice(-9)); // Pre-fill phone number
    };

    const { subtotal, discountAmount, taxAmount, total } = useMemo(() => {
        const TAX_RATE = 0.16; // 16% VAT
        const sub = cart.reduce((acc, item) => acc + item.product.retailPrice * item.quantity, 0);
        
        let disc = 0;
        if (!payingForInvoice) { // No discounts when paying an invoice
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
        setInvoiceSearch('');
        // Do not reset completedSale here, it's used for receipt modal
    };
    
    const handleSelectInvoice = async (invoice: Invoice) => {
        try {
            const detailedInvoice = await getInvoiceDetails(invoice.id);
            const customer = allCustomers.find(c => c.id === detailedInvoice.customer_id);
            if(customer) selectCustomer(customer);

            const cartItems: CartItem[] = (detailedInvoice.items || []).map(item => ({
                product: {
                    id: item.product_id,
                    partNumber: item.part_number || 'N/A',
                    name: item.product_name || 'Unknown Product',
                    retailPrice: item.unit_price,
                    wholesalePrice: item.unit_price, // Assume same for invoice context
                    stock: item.quantity // Not ideal, but reflects what's on the invoice
                },
                quantity: item.quantity,
            }));
            
            setCart(cartItems);
            setPayingForInvoice(detailedInvoice);
            setInvoiceSearch('');
            toast.success(`Loaded invoice ${detailedInvoice.invoice_no}. Cart is now locked.`);

        } catch (err) {
            toast.error("Failed to load invoice details.");
        }
    }
    
    const handleInitiateSale = () => {
        if (!selectedCustomer) { toast.error("Please select a customer."); return; }
        if (cart.length === 0) { toast.error("Cart is empty."); return; }

        if (paymentMethod === 'MPESA') {
            setMpesaStatus('idle');
            setMpesaError(null);
            setIsMpesaModalOpen(true);
        } else {
            completeNonMpesaSale();
        }
    };

    const completeNonMpesaSale = async () => {
        setIsProcessing(true);
        try {
            const payload = {
                customerId: selectedCustomer!.id,
                branchId: currentBranch.id,
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.retailPrice })),
                discount: discountAmount, taxAmount, totalAmount: total, paymentMethod, invoiceId: payingForInvoice?.id
            };
            const saleResult = await createSale(payload);
            setCompletedSale(saleResult);
            toast.success(`Sale ${saleResult.sale_no} completed!`);
            if(payingForInvoice) { setUnpaidInvoices(prev => prev.filter(i => i.id !== payingForInvoice.id)); }
            resetSale();
        } catch (err: any) {
            toast.error(`Failed to complete sale: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleRequestMpesaPayment = async () => {
        if (!mpesaPhoneNumber || !/^\d{9,12}$/.test(mpesaPhoneNumber)) {
            toast.error("Please enter a valid phone number (e.g., 712345678).");
            return;
        }
        setMpesaStatus('waiting');
        try {
            const payload = {
                amount: total,
                phoneNumber: `254${mpesaPhoneNumber.slice(-9)}`,
                cart,
                customerId: selectedCustomer!.id,
                branchId: currentBranch.id,
                invoiceId: payingForInvoice?.id
            };
            const { checkoutRequestId } = await initiateMpesaPayment(payload);
            setMpesaCheckoutId(checkoutRequestId);
        } catch (err: any) {
            setMpesaStatus('failed');
            setMpesaError(err.message || "Failed to initiate payment.");
        }
    };
    
    const handleMpesaModalClose = () => {
        setIsMpesaModalOpen(false);
        if (mpesaStatus === 'success') {
            resetSale();
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
            pdf.save(`Receipt-${completedSale.sale_no}.pdf`);
            toast.success('PDF downloaded!', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate PDF.', { id: toastId });
        }
    };

    return (
      <>
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Point of Sale</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <Card><CardHeader><CardTitle>Pay an Invoice</CardTitle><CardDescription>Search for an unpaid invoice to load it for payment.</CardDescription></CardHeader><CardContent>
                         <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input placeholder="Search by invoice number or customer name..." className="pl-10" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} disabled={isLoadingData || !!payingForInvoice} />
                        </div>
                        {invoiceSearchResults.length > 0 && (
                            <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-20">
                                {invoiceSearchResults.map(i => <li key={i.id} onClick={() => handleSelectInvoice(i)} className="p-3 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm">
                                    <div><p className="font-semibold font-mono">{i.invoice_no}</p><p className="text-xs text-gray-400">{i.customerName}</p></div>
                                    <div className="text-right font-medium">{formatCurrency(i.amount || 0)}</div>
                                </li>)}
                            </ul>
                        )}
                    </CardContent></Card>
                    <Card><CardHeader><CardTitle>Product Search (Ctrl+I)</CardTitle></CardHeader><CardContent>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input ref={productSearchRef} placeholder="Search by part number or name..." className="pl-10" value={productSearch} onChange={e => setProductSearch(e.target.value)} disabled={isLoadingData || !!payingForInvoice} />
                        </div>
                        {productSearchResults.length > 0 && (
                            <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-10">
                                {productSearchResults.map(p => <li key={p.id} onClick={() => addToCart(p)} className="p-3 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm">
                                    <div><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-400 font-mono">{p.partNumber}</p></div>
                                    <div className="text-right"><p className="font-medium">{formatCurrency(p.retailPrice)}</p><p className="text-xs text-gray-500">{p.stock} in stock</p></div>
                                </li>)}
                            </ul>
                        )}
                    </CardContent></Card>
                     <Card><CardHeader><CardTitle>Customer (Ctrl+U)</CardTitle></CardHeader><CardContent>
                         {selectedCustomer ? (
                            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                                <div><p className="font-semibold">{selectedCustomer.name}</p><p className="text-sm text-gray-400">{selectedCustomer.phone}</p></div>
                                {!payingForInvoice && <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4 mr-1"/> Change</Button>}
                            </div>
                        ) : (
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input ref={customerSearchRef} placeholder="Search by name or phone..." className="pl-10" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} disabled={isLoadingData || !!payingForInvoice}/>
                                {customerSearchResults.length > 0 && (
                                    <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-10 absolute w-full">
                                        {customerSearchResults.map(c => <li key={c.id} onClick={() => selectCustomer(c)} className="p-3 hover:bg-gray-700 cursor-pointer text-sm">
                                            <p className="font-semibold">{c.name}</p><p className="text-xs text-gray-400">{c.phone}</p>
                                        </li>)}
                                    </ul>
                                )}
                            </div>
                        )}
                    </CardContent></Card>
                </div>
                <div className="lg:col-span-1">
                    <Card className="sticky top-8">
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                            {payingForInvoice && <CardDescription className="!mt-2 flex items-center gap-2 p-2 rounded-md bg-orange-900/50 text-orange-300 border border-orange-800">
                                <FileText className="h-4 w-4"/> Paying for Invoice <b className="font-mono">{payingForInvoice.invoice_no}</b></CardDescription>}
                        </CardHeader>
                        <CardContent>
                            {cart.length === 0 ? <p className="text-gray-400 text-center py-8">Cart is empty</p> : (
                                <>
                                    <div className="max-h-64 overflow-y-auto pr-2 -mr-2">{cart.map(item => <div key={item.product.id} className="flex items-start justify-between mb-4">
                                        <div className="text-sm"><p className="font-medium text-gray-200">{item.product.name}</p><p className="text-xs text-gray-400">{formatCurrency(item.product.retailPrice)}</p></div>
                                        <div className="flex items-center">
                                            <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} disabled={!!payingForInvoice}><Minus className="h-3 w-3"/></Button>
                                            <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)} className="w-12 text-center h-8 mx-1 p-0" disabled={!!payingForInvoice} />
                                            <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} disabled={!!payingForInvoice}><Plus className="h-3 w-3"/></Button>
                                            <Button variant="ghost" size="sm" className="p-1 h-auto text-red-400 hover:text-red-300 ml-2" onClick={() => removeFromCart(item.product.id)} disabled={!!payingForInvoice}><X className="h-4 w-4"/></Button>
                                        </div>
                                    </div>)}</div>
                                    <div className="border-t border-gray-700 pt-4 mt-4 space-y-3 text-sm">
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
                                        <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-3 mt-3"><span>Total</span><span>{formatCurrency(total)}</span></div>
                                    </div>
                                    <div className="mt-6"><Select ref={paymentMethodRef} label="Payment Method (Ctrl+P)" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                        <option>Cash</option><option>MPESA</option><option>Bank Transfer</option><option>Cheque</option></Select>
                                    </div>
                                    {payingForInvoice && <Button variant="secondary" size="sm" className="w-full mt-4" onClick={() => { resetSale(); setCompletedSale(null); }}><Ban className="h-4 w-4 mr-2"/> Cancel Invoice Payment</Button>}
                                    <Button ref={completeSaleBtnRef} size="lg" className="w-full mt-2" onClick={handleInitiateSale} disabled={isProcessing || !selectedCustomer || cart.length === 0}>
                                        {isProcessing ? <LoaderCircle className="animate-spin h-5 w-5 mr-2" /> : null}
                                        {paymentMethod === 'MPESA' ? 'Pay with M-Pesa' : 'Complete Sale (F10)'}
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <Modal isOpen={isMpesaModalOpen} onClose={handleMpesaModalClose} title="M-Pesa Payment">
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
                <p className="text-gray-400">Waiting for customer to complete transaction on their phone...</p>
            </div>)}
            {mpesaStatus === 'success' && (<div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="font-semibold">Payment Successful!</p>
                <p className="text-gray-400">Sale has been recorded.</p>
                <Button className="mt-4" onClick={handleMpesaModalClose}>Close & New Sale</Button>
            </div>)}
            {mpesaStatus === 'failed' && (<div className="text-center py-8">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="font-semibold">Payment Failed</p>
                <p className="text-gray-400">{mpesaError}</p>
                <div className="flex space-x-2 mt-4"><Button variant="secondary" onClick={handleMpesaModalClose}>Cancel</Button><Button onClick={() => setMpesaStatus('idle')}>Try Again</Button></div>
            </div>)}
        </Modal>

        {completedSale && (
            <Modal isOpen={!!completedSale} onClose={() => { setCompletedSale(null); resetSale(); }} title={`Receipt for ${completedSale.sale_no}`}>
                <div className="text-center mb-4 space-x-2">
                    <p className="mb-4">Sale completed successfully.</p>
                    <Button onClick={() => window.print()} variant="secondary"><Printer className="mr-2 h-4 w-4" /> Print Receipt</Button>
                    <Button onClick={handleDownloadPdf}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                </div>
                <div id="receipt-to-print" className="bg-white"><ReceiptPrint sale={completedSale} /></div>
            </Modal>
        )}
      </>
    );
};

export default POS;