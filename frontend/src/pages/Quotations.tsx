import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import { PlusCircle, LoaderCircle, AlertTriangle, X, Minus, Plus, RefreshCw, Check, Send, Eye, Printer, Download, Edit, ArrowLeft } from 'lucide-react';
import { Quotation, QuotationStatus, Branch, Customer, Product, QuotationPayload } from '@masuma-ea/types';
import { getQuotations, createQuotation, updateQuotationStatus, convertQuotationToInvoice, getQuotationDetails, getProducts, updateQuotation } from '../services/api';
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

// --- Helper Components ---

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

const formatCurrency = (amount: number, currency: string, rates: { [key: string]: number }) => {
    const rate = rates[currency] || 1;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount * rate);
};

// --- Main Page Component ---

const Quotations: React.FC = () => {
    const outletContext = useOutletContext<OutletContextType>();
    const [view, setView] = useState<'list' | 'form' | 'details'>('list');
    const [activeQuotationId, setActiveQuotationId] = useState<number | null>(null);
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const data = await getQuotations();
            setQuotations(data);
        } catch (err) {
            setError("Failed to load quotations.");
            toast.error("Failed to load quotations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'list') {
            fetchQuotations();
        }
    }, [view]);

    const handleNavigate = (targetView: 'list' | 'form' | 'details', id: number | null = null) => {
        setActiveQuotationId(id);
        setView(targetView);
    };

    if (view === 'form') {
        return <QuotationForm quotationId={activeQuotationId} onNavigate={handleNavigate} {...outletContext} />;
    }
    if (view === 'details') {
        return <QuotationDetails quotationId={activeQuotationId} onNavigate={handleNavigate} {...outletContext} />;
    }

    return (
        <QuotationList
            quotations={quotations}
            loading={loading}
            error={error}
            onNavigate={handleNavigate}
            {...outletContext}
        />
    );
};


// --- List View Component ---

interface QuotationListProps extends OutletContextType {
    quotations: Quotation[];
    loading: boolean;
    error: string | null;
    onNavigate: (view: 'list' | 'form' | 'details', id?: number | null) => void;
}

const QuotationList: React.FC<QuotationListProps> = ({ quotations, loading, error, onNavigate, currentCurrency, exchangeRates }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'All'>('All');
    const itemsPerPage = 10;
    const navigate = useNavigate();

    const handleConvertToInvoice = async (id: number) => {
        try {
            const newInvoice = await convertQuotationToInvoice(id);
            toast.success(`Invoice ${newInvoice.invoiceNo} created successfully!`);
            onNavigate('list'); // Refresh list
            navigate('/invoices');
        } catch (err: any) {
            toast.error(`Failed to create invoice: ${err.message}`);
        }
    };

    const filteredQuotations = useMemo(() => {
        return statusFilter === 'All'
            ? quotations
            : quotations.filter(q => q.status === statusFilter);
    }, [quotations, statusFilter]);

    const paginatedQuotations = filteredQuotations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                                <TableCell>{getStatusBadge(q.status)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(q.totalAmount || 0, currentCurrency, exchangeRates)}</TableCell>
                                <TableCell className="space-x-1 flex items-center">
                                    <Button variant="ghost" size="sm" onClick={() => onNavigate('details', q.id)} title="View Details"><Eye className="h-4 w-4"/></Button>
                                    {[QuotationStatus.DRAFT, QuotationStatus.SENT].includes(q.status) && (
                                        <Button variant="ghost" size="sm" onClick={() => onNavigate('form', q.id)} title="Edit Quotation"><Edit className="h-4 w-4"/></Button>
                                    )}
                                    {q.status === QuotationStatus.ACCEPTED && <Button size="sm" onClick={() => handleConvertToInvoice(q.id)} title="Convert to Invoice"><RefreshCw className="h-4 w-4 mr-2"/> To Invoice</Button>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination currentPage={currentPage} totalPages={Math.ceil(filteredQuotations.length / itemsPerPage)} onPageChange={setCurrentPage} />
            </>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Quotations</h1>
                <Button onClick={() => onNavigate('form')}><PlusCircle className="mr-2 h-5 w-5" /> Create Quotation</Button>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>All Quotations</CardTitle>
                            <CardDescription>Browse, manage, and create new quotations.</CardDescription>
                        </div>
                        <Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-48"
                        >
                            <option value="All">All Statuses</option>
                            {(Object.values(QuotationStatus) as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">{renderContent()}</CardContent>
            </Card>
        </div>
    );
};


// --- Form View Component ---

interface QuotationFormProps extends OutletContextType {
    quotationId: number | null;
    onNavigate: (view: 'list' | 'form' | 'details', id?: number | null) => void;
}

const QuotationForm: React.FC<QuotationFormProps> = ({ quotationId, onNavigate, currentBranch, currentCurrency, exchangeRates }) => {
    const { customers: allCustomers, appSettings } = useDataStore();
    const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(false);

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [validUntil, setValidUntil] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
    const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    useEffect(() => {
        const loadQuotation = async () => {
            if (!quotationId) { // Creating new
                const today = new Date();
                today.setDate(today.getDate() + 7);
                setValidUntil(today.toISOString().split('T')[0]);
                return;
            };
            
            setLoading(true);
            try {
                const fullDetails = await getQuotationDetails(quotationId);
                if (!fullDetails || !fullDetails.items || !fullDetails.customer) {
                    toast.error("Could not load full details for editing.");
                    onNavigate('list');
                    return;
                }
                
                const productsResponse = await getProducts({limit: 9999});
                const allProducts = productsResponse.products;
    
                setEditingQuotation(fullDetails);
                setSelectedCustomer(fullDetails.customer as Customer);
                setValidUntil(new Date(fullDetails.validUntil).toISOString().split('T')[0]);
                
                const cartItems = fullDetails.items.map(item => {
                    const product = allProducts.find(p => p.id === item.productId);
                    return product ? { product, quantity: item.quantity } : null;
                }).filter((item): item is CartItem => item !== null);
                
                setCart(cartItems);
                setDiscount(fullDetails.discountAmount || 0);
                setDiscountType('fixed');
            } catch (err) {
                toast.error("Failed to fetch quotation for editing.");
                onNavigate('list');
            } finally {
                setLoading(false);
            }
        };
        loadQuotation();
    }, [quotationId, onNavigate]);

     useEffect(() => {
        if (!productSearch.trim()) { setProductSearchResults([]); return; }
        const timer = setTimeout(async () => {
            setIsSearchingProducts(true);
            try {
                const { products } = await getProducts({ searchTerm: productSearch, limit: 10 });
                setProductSearchResults(products);
            } catch { toast.error('Product search failed.'); } 
            finally { setIsSearchingProducts(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [productSearch]);

    const customerSearchResults = useMemo(() => {
        if (!customerSearch) return [];
        return allCustomers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).slice(0, 5);
    }, [customerSearch, allCustomers]);

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
        let disc = discountType === 'percent' ? sub * (discount / 100) : discount;
        const subtotalAfterDiscount = sub - disc;
        const tax = subtotalAfterDiscount * TAX_RATE;
        const tot = subtotalAfterDiscount + tax;
        return { subtotal: sub, discountAmount: disc, taxAmount: tax, total: tot };
    }, [cart, discount, discountType, appSettings.taxRate]);

    const handleSubmit = async () => {
        if (!selectedCustomer || cart.length === 0) {
            toast.error("Please select a customer and add items.");
            return;
        }

        const payload: QuotationPayload = {
            customerId: selectedCustomer.id,
            branchId: currentBranch.id,
            items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.retailPrice })),
            validUntil, subtotal, discountAmount, taxAmount, totalAmount: total,
        };

        setLoading(true);
        try {
            if (editingQuotation) {
                await updateQuotation(editingQuotation.id, payload);
                toast.success("Quotation updated successfully!");
            } else {
                await createQuotation(payload);
                toast.success("Quotation created successfully!");
            }
            onNavigate('list');
        } catch (err: any) {
            toast.error(`Failed to save quotation: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading && quotationId) {
        return <div className="flex h-full items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin" /></div>;
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => onNavigate('list')}><ArrowLeft className="h-5 w-5 mr-2" /> Back to List</Button>
                <h1 className="text-3xl font-bold">{editingQuotation ? `Edit Quotation ${editingQuotation.quotationNo}` : 'Create New Quotation'}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Customer & Details</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Customer</label>
                                {selectedCustomer ? (
                                    <div className="flex items-center justify-between p-2.5 bg-gray-700/50 rounded-md">
                                        <p className="font-semibold">{selectedCustomer.name}</p>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4 mr-1"/> Change</Button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Input placeholder="Search name or phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                                        {customerSearchResults.length > 0 && <ul className="absolute mt-1 w-full border border-gray-700 rounded-md bg-gray-800 z-30 shadow-lg">{customerSearchResults.map(c => (
                                            <li key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} className="p-2 hover:bg-gray-700 cursor-pointer text-sm">
                                                <p className="font-semibold">{c.name}</p><p className="text-xs text-gray-400">{c.phone}</p>
                                            </li>))}
                                        </ul>}
                                    </div>
                                )}
                            </div>
                            <Input type="date" label="Valid Until" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                        </CardContent>
                    </Card>
                    <Card className="flex-grow flex flex-col">
                        <CardHeader><CardTitle>Quotation Items</CardTitle></CardHeader>
                        <CardContent className="flex-grow flex flex-col">
                            <div className="relative mb-4">
                                <Input placeholder="Search to add products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                                {productSearch.trim() && (
                                    <ul className="absolute mt-1 w-full border border-gray-700 rounded-md bg-gray-800 z-20 shadow-lg max-h-60 overflow-y-auto">
                                        {isSearchingProducts ? <li className="p-2 text-sm">Searching...</li> : productSearchResults.map(p => (
                                            <li key={p.id} onClick={() => addToCart(p)} className="p-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm">
                                                <div><p className="font-semibold">{p.name}</p><p className="text-xs font-mono">{p.partNumber}</p></div>
                                                <p className="text-xs">{p.stock} in stock</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="flex-grow min-h-[300px] border border-gray-700 rounded-md overflow-y-auto">
                               {cart.length === 0 ? <p className="text-gray-400 text-center py-8">No items added.</p> : (
                                <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="w-40 text-center">Quantity</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                                <TableBody>{cart.map(item => (
                                    <TableRow key={item.product.id}>
                                        <TableCell>
                                            <p className="font-medium">{item.product.name}</p>
                                            <p className="text-xs text-gray-400">@ {formatCurrency(item.product.retailPrice, currentCurrency, exchangeRates)}</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center">
                                                <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                                                <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)} className="w-16 text-center h-8 mx-1 p-0" />
                                                <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(item.product.retailPrice * item.quantity, currentCurrency, exchangeRates)}</TableCell>
                                    </TableRow>
                                ))}</TableBody></Table>
                               )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="sticky top-24">
                        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal, currentCurrency, exchangeRates)}</span></div>
                            <div className="flex justify-between items-center text-sm">
                                <span>Discount</span>
                                <div className="flex items-center w-3/5">
                                    <Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="h-8 w-full mr-1"/>
                                    <Select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className="h-8">
                                        <option value="fixed">{currentCurrency}</option>
                                        <option value="percent">%</option>
                                    </Select>
                                </div>
                            </div>
                             <div className="flex justify-between text-sm"><span>VAT ({(appSettings.taxRate || 16)}%)</span><span>{formatCurrency(taxAmount, currentCurrency, exchangeRates)}</span></div>
                            <div className="flex justify-between font-bold text-xl border-t border-gray-600 pt-3 mt-3">
                                <p>Total</p><p>{formatCurrency(total, currentCurrency, exchangeRates)}</p>
                            </div>

                            <div className="flex justify-end space-x-2 pt-6">
                                <Button variant="secondary" onClick={() => onNavigate('list')}>Cancel</Button>
                                <Button onClick={handleSubmit} disabled={loading}>{editingQuotation ? 'Update Quotation' : 'Save Quotation'}</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};


// --- Details View Component ---

interface QuotationDetailsProps extends OutletContextType {
    quotationId: number | null;
    onNavigate: (view: 'list' | 'form' | 'details', id?: number | null) => void;
}

const QuotationDetails: React.FC<QuotationDetailsProps> = ({ quotationId, onNavigate }) => {
    const { appSettings } = useDataStore();
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPrintView, setIsPrintView] = useState(false);
    const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
    
    useEffect(() => {
        if (!quotationId) { onNavigate('list'); return; }
        const fetchDetails = async () => {
            try {
                setLoading(true);
                setQuotation(await getQuotationDetails(quotationId));
            } catch (err) {
                toast.error("Failed to load quotation details.");
                onNavigate('list');
            } finally { setLoading(false); }
        };
        fetchDetails();
    }, [quotationId, onNavigate]);

     useEffect(() => {
        if (isPrintView && quotation) {
            setTimeout(() => { window.print(); setIsPrintView(false); }, 500);
        }
    }, [isPrintView, quotation]);
    
    const handlePrint = (format: 'a4' | 'thermal') => {
        setPrintFormat(format);
        setIsPrintView(true);
    };

    const handleDownloadPdf = async () => {
        const element = document.getElementById('quotation-print-container');
        if (!element || !quotation) return;
        const toastId = toast.loading('Generating PDF...');
        try {
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Quotation-${quotation.quotationNo}.pdf`);
            toast.success('PDF downloaded!', { id: toastId });
        } catch { toast.error('Failed to generate PDF.', { id: toastId }); }
    };

    const handleStatusChange = async (status: QuotationStatus) => {
        if (!quotation) return;
        try {
            const updated = await updateQuotationStatus(quotation.id, status);
            setQuotation(updated);
            toast.success(`Quotation status updated to ${status}.`);
        } catch (err) { toast.error("Failed to update status."); }
    };

    if (loading) return <div className="flex h-full items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin" /></div>;
    if (!quotation) return null;
    
    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => onNavigate('list')}><ArrowLeft className="h-5 w-5 mr-2" /> Back to List</Button>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-4">Quotation {quotation.quotationNo} {getStatusBadge(quotation.status)}</h1>
                        <p className="text-gray-400">For {quotation.customerName} | Created on {new Date(quotation.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                 <div className="flex space-x-2">
                    {quotation.status === QuotationStatus.DRAFT && <Button onClick={() => handleStatusChange(QuotationStatus.SENT)}><Send className="h-4 w-4 mr-2"/>Mark as Sent</Button>}
                    {quotation.status === QuotationStatus.SENT && <Button onClick={() => handleStatusChange(QuotationStatus.ACCEPTED)}><Check className="h-4 w-4 mr-2"/>Mark as Accepted</Button>}
                    <Button onClick={handleDownloadPdf} variant="secondary"><Download className="h-4 w-4 mr-2"/>Download PDF</Button>
                    <Button onClick={() => handlePrint('a4')} variant="secondary"><Printer className="h-4 w-4 mr-2"/>Print</Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 bg-gray-900/50">
                    <div id="quotation-print-container" className="max-h-[70vh] overflow-y-auto">
                        <QuotationPrint quotation={quotation} appSettings={appSettings} isPreview={true} />
                    </div>
                </CardContent>
            </Card>
        </div>

        {isPrintView && (
            <div className="print-area">
                <QuotationPrint quotation={quotation} appSettings={appSettings} format={printFormat} />
            </div>
        )}
        </>
    );
};


export default Quotations;