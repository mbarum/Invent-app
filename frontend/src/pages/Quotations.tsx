import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { PlusCircle, LoaderCircle, AlertTriangle, X, Minus, Plus, RefreshCw, Check, Send, Eye, Printer, Download } from 'lucide-react';
import { Quotation, QuotationStatus, Branch, Customer, Product, QuotationPayload } from '@masuma-ea/types';
// FIX: Removed .ts extension for proper module resolution.
import { getQuotations, createQuotation, updateQuotationStatus, convertQuotationToInvoice, getQuotationDetails } from '../services/api';
import toast from 'react-hot-toast';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import QuotationPrint from '../components/QuotationPrint';
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

const getStatusBadge = (status: QuotationStatus) => {
  let badgeClasses = '';
  switch (status) {
    case QuotationStatus.DRAFT: badgeClasses = 'bg-gray-400/10 text-gray-400 ring-gray-400/20'; break;
    case QuotationStatus.SENT: badgeClasses = 'bg-blue-400/10 text-blue-400 ring-blue-400/20'; break;
    case QuotationStatus.ACCEPTED: badgeClasses = 'bg-teal-400/10 text-teal-400 ring-teal-400/20'; break;
    case QuotationStatus.INVOICED: badgeClasses = 'bg-green-500/10 text-green-400 ring-green-500/20'; break;
    case QuotationStatus.REJECTED: badgeClasses = 'bg-red-400/10 text-red-400 ring-red-400/30'; break;
    case QuotationStatus.EXPIRED: badgeClasses = 'bg-orange-400/10 text-orange-400 ring-orange-400/20'; break;
  }
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${badgeClasses}`}>{status}</span>;
};


const Quotations: React.FC = () => {
    const { currentBranch, currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();
    const { customers: allCustomers, products: allProducts, appSettings } = useDataStore();
    
    // Data state
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal & Form state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
    const [isPrintView, setIsPrintView] = useState(false);
    const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [validUntil, setValidUntil] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchQuotations = async () => {
        try { setLoading(true); setQuotations(await getQuotations()); } 
        catch (err) { setError("Failed to load quotations."); toast.error("Failed to load quotations."); } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchQuotations(); }, []);
    
    useEffect(() => {
        if (isPrintView && viewingQuotation) {
            setTimeout(() => {
                 window.print();
                 setIsPrintView(false);
            }, 500);
        }
    }, [isPrintView, viewingQuotation]);

    const handleOpenCreateModal = () => {
        setIsCreateModalOpen(true);
        const today = new Date();
        today.setDate(today.getDate() + 7); // Default validity: 7 days
        setValidUntil(today.toISOString().split('T')[0]);
    };
    
    const handleCloseCreateModal = () => {
        setIsCreateModalOpen(false);
        setSelectedCustomer(null);
        setCustomerSearch('');
        setProductSearch('');
        setCart([]);
        setDiscount(0);
        setDiscountType('fixed');
    };
    
    const handleViewQuotation = async (id: number) => {
        try {
            const details = await getQuotationDetails(id);
            setViewingQuotation(details);
        } catch (err) {
            toast.error("Failed to load quotation details.");
        }
    };
    
    const handlePrint = (format: 'a4' | 'thermal') => {
        setPrintFormat(format);
        setIsPrintView(true);
    };

    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currentCurrency }).format(amount * rate);
    };

    const handleStatusChange = async (id: number, status: QuotationStatus) => {
        try {
            const updated = await updateQuotationStatus(id, status);
            setQuotations(prev => prev.map(q => q.id === id ? updated : q));
            toast.success(`Quotation status updated to ${status}.`);
        } catch (err) {
            toast.error("Failed to update status.");
        }
    };

    const handleConvertToInvoice = async (id: number) => {
        try {
            const newInvoice = await convertQuotationToInvoice(id);
            toast.success(`Invoice ${newInvoice.invoiceNo} created successfully!`);
            fetchQuotations(); // Refresh list
            navigate('/invoices');
        } catch (err: any) {
            toast.error(`Failed to create invoice: ${err.message}`);
        }
    };
    
    const handleDownloadPdf = async () => {
        const element = document.getElementById('quotation-for-pdf-and-print');
        if (!element || !viewingQuotation) return;
        
        const toastId = toast.loading('Generating PDF...', { duration: 5000 });
        
        try {
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps= pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Quotation-${viewingQuotation.quotationNo}.pdf`);
            toast.success('PDF downloaded!', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate PDF.', { id: toastId });
        }
    };

    // ---- Modal Logic ----
    const customerSearchResults = useMemo(() => {
        if (!customerSearch) return [];
        return allCustomers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).slice(0, 5);
    }, [customerSearch, allCustomers]);
    
    const productSearchResults = useMemo(() => {
        if (!productSearch) return [];
        return allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.partNumber.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [productSearch, allProducts]);

    const addToCart = (product: Product) => {
        const existing = cart.find(i => i.product.id === product.id);
        if(existing) updateQuantity(product.id, existing.quantity + 1);
        else setCart(prev => [...prev, { product, quantity: 1 }]);
        setProductSearch('');
    };
    
    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) setCart(prev => prev.filter(i => i.product.id !== productId));
        else setCart(prev => prev.map(i => i.product.id === productId ? {...i, quantity} : i));
    };

    const { subtotal, discountAmount, taxAmount, total } = useMemo(() => {
        const TAX_RATE = (appSettings.taxRate || 0) / 100;
        const sub = cart.reduce((acc, item) => acc + Number(item.product.retailPrice) * item.quantity, 0);
        let disc = 0;
        if (discountType === 'percent') {
            disc = sub * (discount / 100);
        } else {
            disc = discount;
        }
        const subtotalAfterDiscount = sub - disc;
        const tax = subtotalAfterDiscount * TAX_RATE;
        const tot = subtotalAfterDiscount + tax;

        return { subtotal: sub, discountAmount: disc, taxAmount: tax, total: tot };
    }, [cart, discount, discountType, appSettings.taxRate]);

    const handleSaveQuotation = async () => {
        if (!selectedCustomer || cart.length === 0) {
            toast.error("Please select a customer and add items.");
            return;
        }
        try {
            const payload: QuotationPayload = {
                customerId: selectedCustomer.id,
                branchId: currentBranch.id,
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.retailPrice })),
                validUntil,
                subtotal,
                discountAmount,
                taxAmount,
                totalAmount: total,
            };
            const newQuotation = await createQuotation(payload);
            setQuotations(prev => [newQuotation, ...prev]);
            toast.success("Quotation created successfully!");
            handleCloseCreateModal();
        } catch (err: any) {
            toast.error(`Failed to save quotation: ${err.message}`);
        }
    };

    // --- Render logic ---
    const paginatedQuotations = quotations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        if (quotations.length === 0) return <div className="text-center p-8 text-gray-400">No quotations found.</div>;

        return (
            <>
                <Table>
                    <TableHeader><TableRow>
                        <TableHead>Quote #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {paginatedQuotations.map((q) => (
                            <TableRow key={q.id}>
                                <TableCell className="font-mono">{q.quotationNo}</TableCell>
                                <TableCell>{q.customerName}</TableCell>
                                <TableCell>{new Date(q.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>{new Date(q.validUntil).toLocaleDateString()}</TableCell>
                                <TableCell>{getStatusBadge(q.status)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(q.totalAmount || 0)}</TableCell>
                                <TableCell className="space-x-1">
                                    <Button variant="ghost" size="sm" onClick={() => handleViewQuotation(q.id)} title="View Details"><Eye className="h-4 w-4"/></Button>
                                    {q.status === QuotationStatus.DRAFT && <Button variant="ghost" size="sm" onClick={() => handleStatusChange(q.id, QuotationStatus.SENT)} title="Mark as Sent"><Send className="h-4 w-4"/></Button>}
                                    {q.status === QuotationStatus.SENT && <Button variant="ghost" size="sm" onClick={() => handleStatusChange(q.id, QuotationStatus.ACCEPTED)} title="Mark as Accepted"><Check className="h-4 w-4"/></Button>}
                                    {q.status === QuotationStatus.ACCEPTED && <Button size="sm" onClick={() => handleConvertToInvoice(q.id)} title="Convert to Invoice"><RefreshCw className="h-4 w-4"/> To Invoice</Button>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination currentPage={currentPage} totalPages={Math.ceil(quotations.length / itemsPerPage)} onPageChange={setCurrentPage} />
            </>
        );
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Quotations</h1>
                    <Button onClick={handleOpenCreateModal}><PlusCircle className="mr-2 h-5 w-5" /> Create Quotation</Button>
                </div>
                <Card><CardContent className="p-0">{renderContent()}</CardContent></Card>
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={handleCloseCreateModal} title="Create New Quotation" className="max-w-4xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Customer & Product Search */}
                    <div className="space-y-4">
                        <Card><CardHeader><CardTitle>1. Customer</CardTitle></CardHeader><CardContent>
                            {selectedCustomer ? (
                                <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-md">
                                    <p className="font-semibold">{selectedCustomer.name}</p>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4 mr-1"/> Change</Button>
                                </div>
                            ) : (<>
                                <Input placeholder="Search name or phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                                {customerSearchResults.length > 0 && <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-10">{customerSearchResults.map(c => (
                                    <li key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} className="p-2 hover:bg-gray-700 cursor-pointer text-sm">
                                        <p className="font-semibold">{c.name}</p><p className="text-xs text-gray-400">{c.phone}</p>
                                    </li>))}
                                </ul>}
                            </>)}
                        </CardContent></Card>
                        <Card><CardHeader><CardTitle>2. Add Products</CardTitle></CardHeader><CardContent>
                            <Input placeholder="Search part number or name..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                            {productSearchResults.length > 0 && <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-10">{productSearchResults.map(p => (
                                <li key={p.id} onClick={() => addToCart(p)} className="p-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm">
                                    <div><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-400 font-mono">{p.partNumber}</p></div>
                                    <div className="text-right"><p className="font-medium">{formatCurrency(p.retailPrice)}</p><p className="text-xs text-gray-500">{p.stock} in stock</p></div>
                                </li>))}
                            </ul>}
                        </CardContent></Card>
                    </div>

                    {/* Right: Quotation Details */}
                    <div><Card><CardHeader><CardTitle>3. Quotation Details</CardTitle></CardHeader><CardContent>
                        {cart.length === 0 ? <p className="text-gray-400 text-center py-8">No items added</p> :
                            <div className="max-h-64 overflow-y-auto pr-2 -mr-2 space-y-2">{cart.map(item => (
                                <div key={item.product.id} className="flex items-center justify-between text-sm">
                                    <div>
                                        <p className="font-medium">{item.product.name}</p>
                                        <p className="text-xs text-gray-400">{formatCurrency(item.product.retailPrice)}</p>
                                    </div>
                                    <div className="flex items-center">
                                        <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus className="h-3 w-3"/></Button>
                                        <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)} className="w-12 text-center h-8 mx-1 p-0" />
                                        <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus className="h-3 w-3"/></Button>
                                    </div>
                                </div>))}
                            </div>
                        }
                        <div className="border-t border-gray-700 pt-3 mt-3 space-y-2">
                            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                            <div className="flex justify-between items-center text-sm"><span>Discount</span><div className="flex items-center w-1/2">
                                <Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="h-8 w-full mr-1"/>
                                <Select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className="h-8">
                                    <option value="fixed">{currentCurrency}</option><option value="percent">%</option></Select>
                            </div></div>
                            <div className="flex justify-between text-sm"><span>VAT ({(appSettings.taxRate || 16)}%)</span><span>{formatCurrency(taxAmount)}</span></div>
                            <div className="flex justify-between font-bold text-lg"><p>Total</p><p>{formatCurrency(total)}</p></div>
                             <Input type="date" label="Valid Until" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                        </div>
                    </CardContent></Card></div>
                </div>
                <div className="flex justify-end space-x-2 pt-6">
                    <Button variant="secondary" onClick={handleCloseCreateModal}>Cancel</Button>
                    <Button onClick={handleSaveQuotation}>Save Quotation</Button>
                </div>
            </Modal>
            
            <Modal isOpen={!!viewingQuotation} onClose={() => setViewingQuotation(null)} title={`Quotation Details: ${viewingQuotation?.quotationNo}`} className="max-w-4xl">
                 <div className="flex space-x-2 mb-4">
                    <Button onClick={() => handlePrint('a4')} variant="secondary">
                        <Printer className="mr-2 h-4 w-4" /> Print A4
                    </Button>
                    <Button onClick={() => handlePrint('thermal')} variant="secondary">
                        <Printer className="mr-2 h-4 w-4" /> Print Thermal
                    </Button>
                    <Button onClick={handleDownloadPdf}>
                        <Download className="mr-2 h-4 w-4" /> Download PDF
                    </Button>
                </div>
                <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50 max-h-[70vh] overflow-y-auto">
                    <div id="quotation-preview-content">
                        <QuotationPrint quotation={viewingQuotation} appSettings={appSettings} isPreview={true} />
                    </div>
                </div>
             </Modal>

            {viewingQuotation && isPrintView && (
                <div id="quotation-for-pdf-and-print" className="print-area">
                    <QuotationPrint quotation={viewingQuotation} appSettings={appSettings} format={printFormat} />
                </div>
            )}
        </>
    );
};

export default Quotations;