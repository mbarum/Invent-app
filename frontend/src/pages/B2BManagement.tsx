
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import Button from '../components/ui/Button.tsx';
import Modal from '../components/ui/Modal.tsx';
import { LoaderCircle, AlertTriangle, Check, X, FileText, Eye, Truck } from 'lucide-react';
import { BusinessApplication, ApplicationStatus, StockRequest, StockRequestStatus } from '@masuma-ea/types';
// FIX: Import DOCS_BASE_URL from the correct config file instead of the api service.
import { getB2BApplications, updateB2BApplicationStatus, getAllStockRequests, getStockRequestDetails, updateStockRequestStatus } from '../services/api.ts';
import { DOCS_BASE_URL } from '../config/permissions.ts';
import toast from 'react-hot-toast';

const getAppStatusBadge = (status: ApplicationStatus) => {
  const baseClasses = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset";
  switch (status) {
    case ApplicationStatus.PENDING:
      return <span className={`${baseClasses} bg-yellow-400/10 text-yellow-400 ring-yellow-400/20`}>Pending</span>;
    case ApplicationStatus.APPROVED:
      return <span className={`${baseClasses} bg-green-500/10 text-green-400 ring-green-500/20`}>Approved</span>;
    case ApplicationStatus.REJECTED:
      return <span className={`${baseClasses} bg-red-400/10 text-red-400 ring-red-400/30`}>Rejected</span>;
    default:
      return <span className={`${baseClasses} bg-gray-400/10 text-gray-400 ring-gray-400/20`}>{status}</span>;
  }
};

const getReqStatusBadge = (status: StockRequestStatus) => {
    const baseClasses = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset";
    switch (status) {
        case StockRequestStatus.PENDING: return <span className={`${baseClasses} bg-yellow-400/10 text-yellow-400 ring-yellow-400/20`}>{status}</span>;
        case StockRequestStatus.APPROVED: return <span className={`${baseClasses} bg-blue-400/10 text-blue-400 ring-blue-400/20`}>{status}</span>;
        case StockRequestStatus.SHIPPED: return <span className={`${baseClasses} bg-green-500/10 text-green-400 ring-green-500/20`}>{status}</span>;
        case StockRequestStatus.REJECTED: return <span className={`${baseClasses} bg-red-400/10 text-red-400 ring-red-400/30`}>{status}</span>;
        default: return <span className={`${baseClasses} bg-gray-400/10 text-gray-400 ring-gray-400/20`}>{status}</span>;
    }
};

const ApplicationsManager = () => {
    const [applications, setApplications] = useState<BusinessApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedApp, setSelectedApp] = useState<BusinessApplication | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    useEffect(() => {
        const fetchApplications = async () => {
            try {
                setLoading(true);
                const data = await getB2BApplications();
                setApplications(data);
            } catch (err) {
                setError("Failed to load B2B applications.");
                toast.error("Failed to load applications.");
            } finally {
                setLoading(false);
            }
        };
        fetchApplications();
    }, []);

    const handleUpdateStatus = async (id: string, status: ApplicationStatus) => {
        setIsUpdating(id);
        try {
            const updatedApp = await updateB2BApplicationStatus(id, status);
            setApplications(prev => prev.map(app => (app.id === id ? { ...app, status: updatedApp.status } : app)));
            toast.success(`Application ${status.toLowerCase()} successfully.`);
            setSelectedApp(null);
        } catch (err: any) {
            toast.error(`Failed to update status: ${err.message}`);
        } finally {
            setIsUpdating(null);
        }
    };

    if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
    if (applications.length === 0) return <div className="text-center p-8 text-gray-400">No B2B applications found.</div>;

    return (
        <>
        <Table>
            <TableHeader><TableRow><TableHead>Business Name</TableHead><TableHead>Contact</TableHead><TableHead>Submitted At</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
                {applications.map((app) => (
                    <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.businessName}</TableCell>
                        <TableCell>{app.contactName} <br/> <span className="text-xs text-gray-400">{app.contactEmail}</span></TableCell>
                        <TableCell>{new Date(app.submittedAt).toLocaleDateString()}</TableCell>
                        <TableCell>{getAppStatusBadge(app.status)}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => setSelectedApp(app)}>View Details</Button></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
        {selectedApp && (
            <Modal isOpen={!!selectedApp} onClose={() => setSelectedApp(null)} title={`Application: ${selectedApp.businessName}`} className="max-w-2xl">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="font-semibold text-gray-400">Business Name</p><p>{selectedApp.businessName}</p></div>
                        <div><p className="font-semibold text-gray-400">KRA PIN</p><p>{selectedApp.kraPin}</p></div>
                        <div><p className="font-semibold text-gray-400">Contact Name</p><p>{selectedApp.contactName}</p></div>
                        <div><p className="font-semibold text-gray-400">Contact Email</p><p>{selectedApp.contactEmail}</p></div>
                        <div><p className="font-semibold text-gray-400">Contact Phone</p><p>{selectedApp.contactPhone}</p></div>
                        <div><p className="font-semibold text-gray-400">Status</p><p>{getAppStatusBadge(selectedApp.status)}</p></div>
                    </div>
                    <div className="border-t border-gray-700 pt-4">
                        <h4 className="font-semibold text-gray-200 mb-2">Documents</h4>
                        <div className="flex space-x-4">
                            <a href={`${DOCS_BASE_URL}${selectedApp.certOfIncUrl}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 flex items-center"><FileText className="h-4 w-4 mr-1"/> Certificate of Inc.</a>
                            <a href={`${DOCS_BASE_URL}${selectedApp.cr12Url}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 flex items-center"><FileText className="h-4 w-4 mr-1"/> CR12 Document</a>
                        </div>
                    </div>
                    {selectedApp.status === ApplicationStatus.PENDING && (
                        <div className="flex justify-end space-x-2 pt-4 border-t border-gray-700">
                            <Button variant="secondary" onClick={() => handleUpdateStatus(selectedApp.id, ApplicationStatus.REJECTED)} disabled={isUpdating === selectedApp.id}>
                                {isUpdating === selectedApp.id ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <><X className="h-4 w-4 mr-1"/> Reject</>}
                            </Button>
                            <Button onClick={() => handleUpdateStatus(selectedApp.id, ApplicationStatus.APPROVED)} disabled={isUpdating === selectedApp.id}>
                                {isUpdating === selectedApp.id ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <><Check className="h-4 w-4 mr-1"/> Approve</>}
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>
        )}
        </>
    );
};

const StockRequestsManager = () => {
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    
    const totalAmount = useMemo(() => {
        if (!selectedRequest || !selectedRequest.items) return 0;
        return selectedRequest.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.wholesalePriceAtRequest)), 0);
    }, [selectedRequest]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await getAllStockRequests();
            setRequests(data);
        } catch (err) {
            setError("Failed to load stock requests.");
            toast.error("Failed to load stock requests.");
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchRequests();
    }, []);

    const handleViewDetails = async (request: StockRequest) => {
        try {
            const details = await getStockRequestDetails(request.id);
            setSelectedRequest(details);
        } catch {
            toast.error("Failed to load request details.");
        }
    };

    const handleUpdateStatus = async (id: number, status: StockRequestStatus) => {
        try {
            const updated = await updateStockRequestStatus(id, status);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: updated.status } : r));
            setSelectedRequest(prev => prev ? { ...prev, status: updated.status } : null);
            toast.success(`Request status updated to ${status}.`);
        } catch {
            toast.error("Failed to update status.");
        }
    };

    if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
    if (requests.length === 0) return <div className="text-center p-8 text-gray-400">No stock requests found.</div>;

    return (
        <>
            <Table>
                <TableHeader><TableRow><TableHead>Request ID</TableHead><TableHead>B2B Client</TableHead><TableHead>Date</TableHead><TableHead>Branch</TableHead><TableHead className="text-center">Items</TableHead><TableHead className="text-right">Value (KES)</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                    {requests.map((req) => (
                        <TableRow key={req.id}>
                            <TableCell className="font-mono">REQ-{String(req.id).padStart(5, '0')}</TableCell>
                            <TableCell>{(req as any).userName}</TableCell>
                            <TableCell>{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{(req as any).branchName}</TableCell>
                            <TableCell className="text-center">{req.itemCount || 0}</TableCell>
                            <TableCell className="text-right">{Number(req.totalValue || 0).toLocaleString()}</TableCell>
                            <TableCell>{getReqStatusBadge(req.status)}</TableCell>
                            <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewDetails(req)}><Eye className="h-4 w-4 mr-1"/> View</Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {selectedRequest && (
                 <Modal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} title={`Request REQ-${String(selectedRequest.id).padStart(5, '0')}`} className="max-w-2xl">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                           <p><strong>Client:</strong> {(selectedRequest as any).userName}</p>
                           <p><strong>Branch:</strong> {(selectedRequest as any).branchName}</p>
                           <p><strong>Date:</strong> {new Date(selectedRequest.createdAt).toLocaleString()}</p>
                           <p><strong>Status:</strong> {getReqStatusBadge(selectedRequest.status)}</p>
                        </div>
                        <div className="border-t border-gray-700 pt-4">
                            <h4 className="font-semibold text-gray-200 mb-2">Requested Items</h4>
                            <div className="max-h-60 overflow-y-auto pr-2 -mr-2">
                            <Table>
                                <TableHeader><TableRow><TableHead>Part #</TableHead><TableHead>Product</TableHead><TableHead>Qty</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {selectedRequest.items?.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono text-xs">{(item as any).partNumber}</TableCell>
                                            <TableCell>{(item as any).productName}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                             <p className="text-right font-bold mt-2">Total Value: KES {totalAmount.toLocaleString()}</p>
                        </div>
                        {selectedRequest.status !== StockRequestStatus.SHIPPED && selectedRequest.status !== StockRequestStatus.REJECTED && (
                        <div className="flex justify-end space-x-2 pt-4 border-t border-gray-700">
                           <Button variant="secondary" onClick={() => handleUpdateStatus(selectedRequest.id, StockRequestStatus.REJECTED)}><X className="h-4 w-4 mr-1"/> Reject</Button>
                           {selectedRequest.status === StockRequestStatus.PENDING && <Button onClick={() => handleUpdateStatus(selectedRequest.id, StockRequestStatus.APPROVED)}><Check className="h-4 w-4 mr-1"/> Approve</Button>}
                           {selectedRequest.status === StockRequestStatus.APPROVED && <Button onClick={() => handleUpdateStatus(selectedRequest.id, StockRequestStatus.SHIPPED)}><Truck className="h-4 w-4 mr-1"/> Mark as Shipped</Button>}
                        </div>
                        )}
                    </div>
                </Modal>
            )}
        </>
    );
};


const B2BManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('applications');

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">B2B Management</h1>
            <Card>
                <CardHeader>
                    <div className="border-b border-gray-700">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('applications')}
                                className={`${activeTab === 'applications' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                            >
                                Applications
                            </button>
                            <button
                                onClick={() => setActiveTab('requests')}
                                className={`${activeTab === 'requests' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                            >
                                Stock Requests
                            </button>
                        </nav>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {activeTab === 'applications' ? <ApplicationsManager /> : <StockRequestsManager />}
                </CardContent>
            </Card>
        </div>
    );
};

export default B2BManagement;