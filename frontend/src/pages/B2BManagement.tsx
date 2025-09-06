
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import Button from '../components/ui/Button.tsx';
import Modal from '../components/ui/Modal.tsx';
import { LoaderCircle, AlertTriangle, Check, X, FileText } from 'lucide-react';
import { BusinessApplication, ApplicationStatus } from '@masuma-ea/types';
import { getB2BApplications, updateB2BApplicationStatus, DOCS_BASE_URL } from '../services/api.ts';
import toast from 'react-hot-toast';

const getStatusBadge = (status: ApplicationStatus) => {
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

const B2BManagement: React.FC = () => {
    const [applications, setApplications] = useState<BusinessApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedApp, setSelectedApp] = useState<BusinessApplication | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

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

    useEffect(() => {
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

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        if (applications.length === 0) return <div className="text-center p-8 text-gray-400">No B2B applications found.</div>;

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {applications.map((app) => (
                        <TableRow key={app.id}>
                            <TableCell className="font-medium">{app.businessName}</TableCell>
                            <TableCell>{app.contactName} <br/> <span className="text-xs text-gray-400">{app.contactEmail}</span></TableCell>
                            <TableCell>{new Date(app.submittedAt).toLocaleDateString()}</TableCell>
                            <TableCell>{getStatusBadge(app.status)}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedApp(app)}>View Details</Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    };

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">B2B Application Management</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Wholesale Account Applications</CardTitle>
                        <CardDescription>Review and approve new B2B client applications.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {renderContent()}
                    </CardContent>
                </Card>
            </div>

            {selectedApp && (
                <Modal isOpen={!!selectedApp} onClose={() => setSelectedApp(null)} title={`Application: ${selectedApp.businessName}`} className="max-w-2xl">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><p className="font-semibold text-gray-400">Business Name</p><p>{selectedApp.businessName}</p></div>
                            <div><p className="font-semibold text-gray-400">KRA PIN</p><p>{selectedApp.kraPin}</p></div>
                            <div><p className="font-semibold text-gray-400">Contact Name</p><p>{selectedApp.contactName}</p></div>
                            <div><p className="font-semibold text-gray-400">Contact Email</p><p>{selectedApp.contactEmail}</p></div>
                            <div><p className="font-semibold text-gray-400">Contact Phone</p><p>{selectedApp.contactPhone}</p></div>
                            <div><p className="font-semibold text-gray-400">Status</p><p>{getStatusBadge(selectedApp.status)}</p></div>
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

export default B2BManagement;
