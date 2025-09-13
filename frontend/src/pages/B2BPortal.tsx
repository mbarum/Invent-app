import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import Button from '../components/ui/Button.tsx';
import Select from '../components/ui/Select.tsx';
import Input from '../components/ui/Input.tsx';
import Modal from '../components/ui/Modal.tsx';
import { LoaderCircle, AlertTriangle, Search, Plus, Minus, X, CheckCircle, PackagePlus, History } from 'lucide-react';
import { useDataStore } from '../store/dataStore.ts';
// FIX: Import CreateStockRequestPayload from the types package instead of the api service.
import { Product, Branch, StockRequest, StockRequestStatus, StockRequestItem, CreateStockRequestPayload } from '@masuma-ea/types';
import { createStockRequest, getMyStockRequests, getStockRequestDetails } from '../services/api.ts';
import toast from 'react-hot-toast';

interface RequestCartItem {
    product: Product;
    quantity: number;
}

const getStatusBadge = (status: StockRequestStatus) => {
    const baseClasses = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset";
    switch (status) {
        case StockRequestStatus.PENDING: return <span className={`${baseClasses} bg-yellow-400/10 text-yellow-400 ring-yellow-400/20`}>{status}</span>;
        case StockRequestStatus.APPROVED: return <span className={`${baseClasses} bg-blue-400/10 text-blue-400 ring-blue-400/20`}>{status}</span>;
        case StockRequestStatus.SHIPPED: return <span className={`${baseClasses} bg-green-500/10 text-green-400 ring-green-500/20`}>{status}</span>;
        case StockRequestStatus.REJECTED: return <span className={`${baseClasses} bg-red-400/10 text-red-400 ring-red-400/30`}>{status}</span>;
        default: return <span className={`${baseClasses} bg-gray-400/10 text-gray-400 ring-gray-400/20`}>{status}</span>;
    }
};

const CreateRequest = ({ onSubmitted }: { onSubmitted: () => void }) => {
    const { products, branches } = useDataStore();
    const [cart, setCart] = useState<RequestCartItem[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | string>('');
    const [productSearch, setProductSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const productSearchResults = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.partNumber.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [productSearch, products]);
    
    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.product.wholesalePrice * item.quantity, 0);
    }, [cart]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(i => i.product.id === product.id);
            if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { product, quantity: 1 }];
        });
        setProductSearch('');
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) setCart(prev => prev.filter(i => i.product.id !== productId));
        else setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity } : i));
    };

    const handleSubmit = async () => {
        if (!selectedBranchId || cart.length === 0) {
            toast.error("Please select a branch and add items to your request.");
            return;
        }
        setIsSubmitting(true);
        try {
            const payload: CreateStockRequestPayload = {
                branchId: Number(selectedBranchId),
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
            };
            await createStockRequest(payload);
            toast.success("Stock request submitted successfully!");
            setCart([]);
            setSelectedBranchId('');
            onSubmitted();
        } catch (err: any) {
            toast.error(`Submission failed: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader><CardTitle>1. Select Branch</CardTitle></CardHeader>
                    <CardContent><Select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
                        <option value="" disabled>Select a fulfillment branch...</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select></CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>2. Find Products</CardTitle><CardDescription>Search the wholesale catalogue and add items to your request.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input placeholder="Search by part number or name..." className="pl-10" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                        </div>
                        {productSearchResults.length > 0 && (
                            <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-10">{productSearchResults.map(p => 
                                <li key={p.id} onClick={() => addToCart(p)} className="p-3 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm">
                                    <div><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-400 font-mono">{p.partNumber}</p></div>
                                    <div className="text-right"><p className="font-medium text-orange-400">KES {p.wholesalePrice.toLocaleString()}</p><p className="text-xs text-gray-500">{p.stock} in stock</p></div>
                                </li>)}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1"><Card className="sticky top-8">
                <CardHeader><CardTitle>Request Summary</CardTitle></CardHeader>
                <CardContent>
                    {cart.length === 0 ? <p className="text-center text-gray-400 py-8">Your request is empty</p> : 
                    <div className="space-y-4">
                        <div className="max-h-80 overflow-y-auto pr-2 -mr-2 space-y-3">{cart.map(item => (
                             <div key={item.product.id} className="flex items-center justify-between text-sm">
                                <div><p className="font-medium leading-tight">{item.product.name}</p><p className="text-xs text-gray-400">KES {item.product.wholesalePrice.toLocaleString()}</p></div>
                                <div className="flex items-center flex-shrink-0 ml-2">
                                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus className="h-3 w-3"/></Button>
                                    <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)} className="w-12 text-center h-8 mx-1 p-0" />
                                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus className="h-3 w-3"/></Button>
                                </div>
                            </div>
                        ))}</div>
                        <div className="border-t border-gray-700 pt-4 mt-4">
                            <div className="flex justify-between font-bold text-lg"><p>Estimated Total</p><p>KES {subtotal.toLocaleString()}</p></div>
                            <Button size="lg" className="w-full mt-4" disabled={isSubmitting || cart.length === 0 || !selectedBranchId} onClick={handleSubmit}>
                                {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin mr-2"/> : <PackagePlus className="h-5 w-5 mr-2" />}
                                Submit Request
                            </Button>
                        </div>
                    </div>}
                </CardContent>
            </Card></div>
        </div>
    );
};

const RequestHistory = () => {
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try { setLoading(true); setRequests(await getMyStockRequests()); }
            catch { setError("Failed to load request history."); }
            finally { setLoading(false); }
        };
        fetchHistory();
    }, []);

    const handleViewDetails = async (request: StockRequest) => {
        try {
            const details = await getStockRequestDetails(request.id);
            setSelectedRequest(details);
        } catch { toast.error("Failed to load request details."); }
    };
    
    if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;

    return (
        <Card>
            <CardHeader><CardTitle>My Request History</CardTitle><CardDescription>Track the status of all your stock requests.</CardDescription></CardHeader>
            <CardContent>
            {requests.length === 0 ? <p className="text-center text-gray-400 py-8">You have not made any requests yet.</p> :
            <Table>
                <TableHeader><TableRow><TableHead>Request ID</TableHead><TableHead>Date</TableHead><TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>{requests.map(req => (
                    <TableRow key={req.id}>
                        <TableCell className="font-mono">REQ-{String(req.id).padStart(5, '0')}</TableCell>
                        <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{(req as any).branchName}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewDetails(req)}>View Details</Button></TableCell>
                    </TableRow>
                ))}</TableBody>
            </Table>}
            </CardContent>
            {selectedRequest && <Modal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} title={`Details for REQ-${String(selectedRequest.id).padStart(5, '0')}`}>
                <div className="max-h-96 overflow-y-auto pr-2 -mr-2">
                <Table>
                    <TableHeader><TableRow><TableHead>Part #</TableHead><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {selectedRequest.items?.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs">{(item as any).partNumber}</TableCell>
                                <TableCell>{(item as any).productName}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell className="text-right">KES {item.wholesale_price_at_request.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
            </Modal>}
        </Card>
    );
};


const B2BPortal: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
    
    // A key to force re-render of history tab after a new submission
    const [historyKey, setHistoryKey] = useState(0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">B2B Portal</h1>
            </div>
             <div className="border-b border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('create')} className={`${activeTab === 'create' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} flex items-center whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}>
                        <PackagePlus className="h-5 w-5 mr-2"/> Create New Request
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`${activeTab === 'history' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} flex items-center whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}>
                        <History className="h-5 w-5 mr-2"/> My Requests
                    </button>
                </nav>
            </div>
            <div>
                {activeTab === 'create' ? <CreateRequest onSubmitted={() => { setActiveTab('history'); setHistoryKey(k => k + 1); }} /> : <RequestHistory key={historyKey} />}
            </div>
        </div>
    );
};

export default B2BPortal;