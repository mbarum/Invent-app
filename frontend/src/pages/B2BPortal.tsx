import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { LoaderCircle, AlertTriangle, Search, Plus, Minus, X, CheckCircle, PackagePlus, History } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { Product, Branch, StockRequest, StockRequestStatus, StockRequestItem, CreateStockRequestPayload } from '@masuma-ea/types';
// FIX: Removed .ts extension for proper module resolution.
import { createStockRequest, getMyStockRequests, getStockRequestDetails } from '../services/api';
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

const B2BPortal: React.FC = () => {
    const { products: allProducts, branches, isInitialDataLoaded } = useDataStore();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New Request State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [requestCart, setRequestCart] = useState<RequestCartItem[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [productSearch, setProductSearch] = useState('');
    
    // View History State
    const [viewingRequest, setViewingRequest] = useState<StockRequest | null>(null);

    useEffect(() => {
        const fetchMyRequests = async () => {
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
        if (isInitialDataLoaded) {
            fetchMyRequests();
            if (branches.length > 0) {
                setSelectedBranch(branches[0]);
            }
        }
    }, [isInitialDataLoaded, branches]);
    
    const productSearchResults = useMemo(() => {
        if (!productSearch) return [];
        return allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.partNumber.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [productSearch, allProducts]);

    const addToCart = (product: Product) => {
        const existing = requestCart.find(i => i.product.id === product.id);
        if(existing) updateQuantity(product.id, existing.quantity + 1);
        else setRequestCart(prev => [...prev, { product, quantity: 1 }]);
        setProductSearch('');
    };
    
    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) setRequestCart(prev => prev.filter(i => i.product.id !== productId));
        else setRequestCart(prev => prev.map(i => i.product.id === productId ? {...i, quantity} : i));
    };
    
    const handleCreateRequest = async () => {
        if (!selectedBranch || requestCart.length === 0) {
            toast.error("Please select a branch and add items to your request.");
            return;
        }
        try {
            const payload: CreateStockRequestPayload = {
                branchId: selectedBranch.id,
                items: requestCart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
            };
            await createStockRequest(payload);
            setIsCreateModalOpen(false);
            setIsSuccessModalOpen(true);
            setRequestCart([]);
            // Refetch requests
            const data = await getMyStockRequests();
            setRequests(data);
        } catch (err: any) {
            toast.error(`Failed to submit request: ${err.message}`);
        }
    };
    
    const handleViewDetails = async (request: StockRequest) => {
        try {
            const details = await getStockRequestDetails(request.id);
            setViewingRequest(details);
        } catch(err) {
            toast.error("Could not load request details.");
        }
    };

    const renderHistory = () => {
        if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        if (requests.length === 0) return <div className="text-center p-8 text-gray-400">You have not made any stock requests yet.</div>;
        
        return (
            <Table>
                <TableHeader><TableRow><TableHead>Request ID</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Items</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>{requests.map(req => (
                    <TableRow key={req.id}>
                        <TableCell className="font-mono">REQ-{String(req.id).padStart(5, '0')}</TableCell>
                        <TableCell>{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell>{req.itemCount}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewDetails(req)}>View Details</Button></TableCell>
                    </TableRow>
                ))}</TableBody>
            </Table>
        );
    };

    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">B2B Stock Portal</h1>
                <Button onClick={() => setIsCreateModalOpen(true)}><PackagePlus className="mr-2 h-5 w-5"/> New Stock Request</Button>
            </div>
            <Card>
                <CardHeader><CardTitle>Request History</CardTitle><CardDescription>A log of all your stock requests and their current status.</CardDescription></CardHeader>
                <CardContent>{renderHistory()}</CardContent>
            </Card>
        </div>
        
        {/* Create Request Modal */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Stock Request" className="max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <Select label="Request From Branch" value={selectedBranch?.id || ''} onChange={(e) => setSelectedBranch(branches.find(b => b.id === parseInt(e.target.value)) || null)}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                    <div>
                        <Input placeholder="Search product name or part number..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                        {productSearchResults.length > 0 && <ul className="mt-2 border border-gray-700 rounded-md bg-gray-800 z-10">{productSearchResults.map(p => (
                            <li key={p.id} onClick={() => addToCart(p)} className="p-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-sm">
                                <div><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-400 font-mono">{p.partNumber}</p></div>
                                <p className="text-xs text-gray-500">{p.stock} in stock</p>
                            </li>))}
                        </ul>}
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold mb-2">Request Cart</h3>
                    {requestCart.length === 0 ? <p className="text-gray-400 text-center py-8">No items added</p> : 
                        <div className="max-h-80 overflow-y-auto pr-2 -mr-2 space-y-2">{requestCart.map(item => (
                            <div key={item.product.id} className="flex items-center justify-between text-sm">
                                <p className="font-medium">{item.product.name}</p>
                                <div className="flex items-center">
                                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus className="h-3 w-3"/></Button>
                                    <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)} className="w-12 text-center h-8 mx-1 p-0" />
                                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus className="h-3 w-3"/></Button>
                                    <Button variant="ghost" size="sm" className="p-1 h-auto text-red-500" onClick={() => updateQuantity(item.product.id, 0)}><X className="h-3 w-3"/></Button>
                                </div>
                            </div>))}
                        </div>
                    }
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-6 border-t border-gray-700 mt-4">
                <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRequest}>Submit Request</Button>
            </div>
        </Modal>

        {/* Success Modal */}
        <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} title="Success!">
            <div className="text-center py-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Your stock request has been submitted.</h3>
                <p className="text-gray-400 mt-2">You will be notified once it has been reviewed by our team.</p>
                <Button className="mt-6" onClick={() => setIsSuccessModalOpen(false)}>Close</Button>
            </div>
        </Modal>

        {/* View Details Modal */}
        {viewingRequest && <Modal isOpen={!!viewingRequest} onClose={() => setViewingRequest(null)} title={`Details for REQ-${String(viewingRequest.id).padStart(5, '0')}`}>
            <div className="space-y-4">
                <p>Status: {getStatusBadge(viewingRequest.status)}</p>
                <div className="max-h-80 overflow-y-auto pr-2 -mr-2">
                    <Table>
                        <TableHeader><TableRow><TableHead>Part #</TableHead><TableHead>Product</TableHead><TableHead>Qty</TableHead></TableRow></TableHeader>
                        <TableBody>{viewingRequest.items?.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs">{item.partNumber}</TableCell>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </div>
            </div>
        </Modal>}
        </>
    );
};

export default B2BPortal;
