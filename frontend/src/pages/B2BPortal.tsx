import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PlusCircle, LoaderCircle, AlertTriangle, Minus, Plus, Eye, CheckCircle, XCircle } from 'lucide-react';
import { StockRequest, StockRequestStatus, Product, StockRequestItem } from '@masuma-ea/types';
import { getMyStockRequests, getStockRequestDetails, createStockRequest, getProducts, initiateStockRequestPayment, getMpesaPaymentStatus } from '../services/api';
import toast from 'react-hot-toast';
import { useDataStore } from '../store/dataStore';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';

const getStatusBadge = (status: StockRequestStatus) => {
    const baseClasses = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset";
    switch (status) {
        case StockRequestStatus.PENDING: return <span className={`${baseClasses} bg-yellow-400/10 text-yellow-400 ring-yellow-400/20`}>{status}</span>;
        case StockRequestStatus.APPROVED: return <span className={`${baseClasses} bg-blue-400/10 text-blue-400 ring-blue-400/20`}>Approved (Awaiting Payment)</span>;
        case StockRequestStatus.PAID: return <span className={`${baseClasses} bg-purple-400/10 text-purple-400 ring-purple-400/20`}>{status}</span>;
        case StockRequestStatus.SHIPPED: return <span className={`${baseClasses} bg-green-500/10 text-green-400 ring-green-500/20`}>{status}</span>;
        case StockRequestStatus.REJECTED: return <span className={`${baseClasses} bg-red-400/10 text-red-400 ring-red-400/30`}>{status}</span>;
        default: return <span className={`${baseClasses} bg-gray-400/10 text-gray-400 ring-gray-400/20`}>{status}</span>;
    }
};

interface CartItem {
    product: Product;
    quantity: number;
}

const B2BPortal: React.FC = () => {
    const { branches, isInitialDataLoaded: isDataStoreLoaded } = useDataStore();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);

    // New request form state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    // M-Pesa Payment State
    const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
    const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'waiting' | 'success' | 'failed'>('idle');
    const [mpesaCheckoutId, setMpesaCheckoutId] = useState<string | null>(null);
    const [mpesaError, setMpesaError] = useState<string | null>(null);


    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data = await getMyStockRequests();
            setRequests(data);
        } catch (err) {
            setError("Failed to load your stock requests.");
            toast.error("Failed to load requests.");
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if (mpesaStatus !== 'waiting' || !mpesaCheckoutId) return;

        const interval = setInterval(async () => {
            try {
                const { status, message } = await getMpesaPaymentStatus(mpesaCheckoutId);
                if (status === 'Completed') {
                    setMpesaStatus('success');
                    fetchRequests(); // Refresh list to show 'Paid' status
                    clearInterval(interval);
                } else if (status === 'Failed') {
                    setMpesaStatus('failed');
                    setMpesaError(message || 'Payment failed or was cancelled.');
                    clearInterval(interval);
                }
            } catch (err) { console.error("Polling error:", err); }
        }, 5000);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            if (mpesaStatus === 'waiting') {
                setMpesaStatus('failed');
                setMpesaError('Payment timed out. Please try again.');
            }
        }, 120000);

        return () => { clearInterval(interval); clearTimeout(timeout); };
    }, [mpesaStatus, mpesaCheckoutId]);

    useEffect(() => {
        fetchRequests();
        if (branches.length > 0) {
            setSelectedBranchId(branches[0].id);
        }
    }, [branches]);
    
    useEffect(() => {
        if (!productSearch.trim()) {
            setProductSearchResults([]);
            return;
        }

        const debounceTimer = setTimeout(async () => {
            setIsSearchingProducts(true);
            try {
                const { products } = await getProducts({ searchTerm: productSearch, limit: 10 });
                setProductSearchResults(products);
            } catch (error) {
                toast.error('Product search failed.');
            } finally {
                setIsSearchingProducts(false);
            }
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [productSearch]);

    const handleOpenCreateModal = () => {
        setCart([]);
        setProductSearch('');
        if (branches.length > 0) setSelectedBranchId(branches[0].id);
        setIsCreateModalOpen(true);
    };

    const handleViewDetails = async (request: StockRequest) => {
        try {
            const details = await getStockRequestDetails(request.id);
            setSelectedRequest(details);
            setIsViewModalOpen(true);
        } catch (err) {
            toast.error("Failed to load request details.");
        }
    };

    const addToCart = (product: Product) => {
        const existing = cart.find(i => i.product.id === product.id);
        if (existing) {
            updateQuantity(product.id, existing.quantity + 1);
        } else {
            setCart(prev => [...prev, { product, quantity: 1 }]);
        }
        setProductSearch('');
        setProductSearchResults([]);
    };
    
    const updateQuantity = (productId: string, quantity: number) => {
        const numQuantity = Number(quantity);
        if (numQuantity < 1) {
            setCart(prev => prev.filter(i => i.product.id !== productId));
        } else {
            setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: numQuantity } : i));
        }
    };
    
    const handleSubmitRequest = async () => {
        if (!selectedBranchId || cart.length === 0) {
            toast.error("Please select a branch and add items to your request.");
            return;
        }
        const payload = {
            branchId: selectedBranchId,
            items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity }))
        };
        try {
            await createStockRequest(payload);
            toast.success("Stock request submitted successfully!");
            setIsCreateModalOpen(false);
            fetchRequests(); // Refresh the list
        } catch (err: any) {
            toast.error(`Failed to submit request: ${err.message}`);
        }
    };
    
    const handlePayNow = () => {
        setIsViewModalOpen(false);
        setIsPaymentModalOpen(true);
        setMpesaStatus('idle');
        setMpesaError(null);
    };

    const handleRequestMpesaPayment = async () => {
        if (!selectedRequest || !mpesaPhoneNumber || !/^\d{9,12}$/.test(mpesaPhoneNumber)) {
            toast.error("Please enter a valid phone number (e.g., 712345678)."); return;
        }
        setMpesaStatus('waiting');
        try {
            const { checkoutRequestId } = await initiateStockRequestPayment(selectedRequest.id, `254${mpesaPhoneNumber.slice(-9)}`, approvedTotal);
            setMpesaCheckoutId(checkoutRequestId);
        } catch (err: any) {
            setMpesaStatus('failed'); setMpesaError(err.message || "Failed to initiate payment.");
        }
    };


    const totalValue = useMemo(() =>
        cart.reduce((sum, item) => sum + item.product.wholesalePrice * item.quantity, 0),
        [cart]
    );
    
    const approvedTotal = useMemo(() => {
        if (!selectedRequest || !selectedRequest.items) return 0;
        return selectedRequest.items.reduce((sum, item) => sum + ((item.approvedQuantity ?? 0) * item.wholesalePriceAtRequest), 0);
    }, [selectedRequest]);


    const renderContent = () => {
        if (loading || !isDataStoreLoaded) return <div className="flex justify-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="text-center p-8 text-red-400"><AlertTriangle className="mr-2 h-6 w-6 inline-block" /> {error}</div>;
        if (requests.length === 0) return <div className="text-center p-8 text-gray-400">You have not made any stock requests yet.</div>;
        
        return (
            <Table>
                <TableHeader><TableRow><TableHead>Request ID</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Items</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                    {requests.map(req => (
                        <TableRow key={req.id}>
                            <TableCell className="font-mono">REQ-{String(req.id).padStart(5, '0')}</TableCell>
                            <TableCell>{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{getStatusBadge(req.status)}</TableCell>
                            <TableCell>{req.itemCount}</TableCell>
                            <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewDetails(req)}><Eye className="h-4 w-4 mr-1"/> View</Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    };

    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">B2B Stock Portal</h1>
                <Button onClick={handleOpenCreateModal}><PlusCircle className="mr-2 h-5 w-5" /> New Stock Request</Button>
            </div>

            <Card>
                <CardHeader><CardTitle>My Stock Requests</CardTitle><CardDescription>A history of all your submitted stock requests.</CardDescription></CardHeader>
                <CardContent className="p-0">{renderContent()}</CardContent>
            </Card>
        </div>

        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Stock Request" className="max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <Select label="Select Branch for Stock" value={selectedBranchId ?? ''} onChange={e => setSelectedBranchId(Number(e.target.value))}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                    <div className="relative">
                        <Input placeholder="Search to add parts..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
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
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Request Summary</h3>
                    <div className="border border-gray-700 rounded-md h-64 overflow-y-auto p-2 space-y-2">
                        {cart.length === 0 ? <p className="text-center text-gray-500 pt-8">No items added.</p> : cart.map(item => (
                            <div key={item.product.id} className="flex items-center justify-between text-sm">
                                <div><p className="font-medium">{item.product.name}</p><p className="text-xs font-mono">{item.product.partNumber}</p></div>
                                <div className="flex items-center">
                                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                                    <Input type="number" value={item.quantity} onChange={e => updateQuantity(item.product.id, Number(e.target.value))} className="w-14 text-center h-8 mx-1 p-0"/>
                                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-right font-bold text-lg pt-2">
                        Approximate Total: KES {totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-6 border-t border-gray-700 mt-6">
                <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitRequest}>Submit Request</Button>
            </div>
        </Modal>

        <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={`Details for REQ-${String(selectedRequest?.id).padStart(5, '0')}`}>
            {selectedRequest?.items ? (<>
                <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Requested</TableHead><TableHead>Approved</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                    <TableBody>{selectedRequest.items.map((item: StockRequestItem) => (
                        <TableRow key={item.id} className={item.approvedQuantity === 0 ? 'bg-red-900/30' : ''}>
                            <TableCell><p className="font-medium">{item.productName}</p><p className="text-xs font-mono">{item.partNumber}</p></TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.approvedQuantity ?? 'N/A'}</TableCell>
                            <TableCell className="text-right">KES {item.wholesalePriceAtRequest.toLocaleString()}</TableCell>
                        </TableRow>
                    ))}</TableBody>
                </Table>
                {selectedRequest.status === StockRequestStatus.APPROVED && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                        <div className="text-xl font-bold">Total Due: KES {approvedTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <Button onClick={handlePayNow}>Pay Now via M-Pesa</Button>
                    </div>
                )}
                </>) : <LoaderCircle className="animate-spin" />}
        </Modal>

        <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Complete Payment">
             {mpesaStatus === 'idle' && (<div className="space-y-4">
                <CardDescription>Enter your M-Pesa phone number to receive a payment request.</CardDescription>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">+254</span>
                    <Input label="Phone Number (Safaricom)" name="phone" value={mpesaPhoneNumber} onChange={(e) => setMpesaPhoneNumber(e.target.value)} placeholder="712345678" className="pl-14"/>
                </div>
                <p className="text-lg font-bold text-center">Amount: KES {approvedTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                <Button className="w-full" onClick={handleRequestMpesaPayment}>Request Payment</Button>
            </div>)}
            {mpesaStatus === 'waiting' && (<div className="text-center py-8">
                <LoaderCircle className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" /><p className="font-semibold">STK Push Sent</p><p className="text-gray-400">Waiting for you to complete the transaction...</p>
            </div>)}
            {mpesaStatus === 'success' && (<div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" /><p className="font-semibold">Payment Successful!</p><p className="text-gray-400">Your order is now being processed.</p><Button className="mt-4" onClick={() => setIsPaymentModalOpen(false)}>Close</Button>
            </div>)}
            {mpesaStatus === 'failed' && (<div className="text-center py-8">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" /><p className="font-semibold">Payment Failed</p><p className="text-gray-400">{mpesaError}</p><div className="flex space-x-2 mt-4 justify-center"><Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button><Button onClick={() => setMpesaStatus('idle')}>Try Again</Button></div>
            </div>)}
        </Modal>
        </>
    );
};

export default B2BPortal;