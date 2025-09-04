import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
import { CheckCircle, XCircle, LoaderCircle, AlertTriangle, FileText } from 'lucide-react';
// FIX: Changed import path for `types` to allow module resolution by removing the file extension.
import { BusinessApplication, ApplicationStatus } from '@masuma-ea/types';
import { getB2BApplications, updateB2BApplicationStatus, DOCS_BASE_URL } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
// FIX: Changed import path for `permissions` to allow module resolution by removing the file extension.
import { PERMISSIONS } from '../config/permissions';

const getStatusBadge = (status: ApplicationStatus) => {
  let badgeClasses = '';
  switch (status) {
    case ApplicationStatus.PENDING:
      badgeClasses = 'bg-yellow-400/10 text-yellow-400 ring-yellow-400/20';
      break;
    case ApplicationStatus.APPROVED:
      badgeClasses = 'bg-green-500/10 text-green-400 ring-green-500/20';
      break;
    case ApplicationStatus.REJECTED:
      badgeClasses = 'bg-red-400/10 text-red-400 ring-red-400/30';
      break;
    default:
      badgeClasses = 'bg-gray-400/10 text-gray-400 ring-gray-400/20';
      break;
  }

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${badgeClasses}`}>
      {status}
    </span>
  );
};

const B2BManagement: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.MANAGE_B2B);

  const [applications, setApplications] = useState<BusinessApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplications, setSelectedApplications] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const data = await getB2BApplications();
        setApplications(data);
        setError(null);
      } catch (err) {
        setError("Failed to load applications.");
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);
  
  const filteredApplications = applications
    .filter(app => statusFilter === 'All' || app.status === statusFilter)
    .filter(app => {
      const term = searchTerm.toLowerCase();
      return (
        app.businessName.toLowerCase().includes(term) ||
        app.contactName.toLowerCase().includes(term) ||
        app.contactEmail.toLowerCase().includes(term) ||
        app.kraPin.toLowerCase().includes(term)
      );
    });

  const pendingAppIdsInView = filteredApplications
    .filter(app => app.status === ApplicationStatus.PENDING)
    .map(app => app.id);
  
  const selectedPendingCount = selectedApplications.filter(id => pendingAppIdsInView.includes(id)).length;

  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const paginatedApplications = filteredApplications.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const checkbox = selectAllCheckboxRef.current;
    if (checkbox) {
      const totalPending = pendingAppIdsInView.length;
      checkbox.checked = totalPending > 0 && selectedPendingCount === totalPending;
      checkbox.indeterminate = selectedPendingCount > 0 && selectedPendingCount < totalPending;
    }
  }, [selectedPendingCount, pendingAppIdsInView.length]);

  const handleUpdateStatus = async (id: string, newStatus: ApplicationStatus) => {
    try {
        const updatedApp = await updateB2BApplicationStatus(id, newStatus);
        setApplications(apps => apps.map(app => app.id === id ? updatedApp : app));
        toast.success(`Application has been ${newStatus.toLowerCase()}.`);
    } catch (err) {
        toast.error("Failed to update status. Please try again.");
    }
  };

  const handleSelect = (id: string) => {
    setSelectedApplications(prev =>
      prev.includes(id) ? prev.filter(appId => appId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Add all PENDING from the CURRENTLY FILTERED view to selection
      setSelectedApplications(prev => [...new Set([...prev, ...pendingAppIdsInView])]);
    } else {
      // Remove all PENDING from the CURRENTLY FILTERED view from selection
      setSelectedApplications(prev => prev.filter(id => !pendingAppIdsInView.includes(id)));
    }
  };

  const handleBulkUpdate = async (newStatus: ApplicationStatus) => {
    const actionText = newStatus.toLowerCase();
    const toastId = toast.loading(`Performing bulk ${actionText}...`);

    const results = await Promise.allSettled(
      selectedApplications.map(id => updateB2BApplicationStatus(id, newStatus))
    );

    let successCount = 0;
    const updatedApplications = [...applications];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        successCount++;
        const updatedApp = result.value;
        const appIndex = updatedApplications.findIndex(app => app.id === updatedApp.id);
        if (appIndex !== -1) {
          updatedApplications[appIndex] = updatedApp;
        }
      }
    });

    setApplications(updatedApplications);

    if (successCount === selectedApplications.length) {
      toast.success(`${successCount} application(s) successfully ${actionText}.`, { id: toastId });
    } else {
      const failureCount = selectedApplications.length - successCount;
      toast.error(
        `${successCount} ${actionText}, ${failureCount} failed. Please refresh and try again.`,
        { id: toastId, duration: 5000 }
      );
    }

    setSelectedApplications([]);
  };
  
  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    }
    if (error) {
      return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
    }
    if (applications.length > 0 && filteredApplications.length === 0) {
        return <div className="text-center p-8 text-gray-400">No applications found matching your criteria.</div>;
    }
    return (
      <>
        {canManage && selectedApplications.length > 0 && (
          <div className="mb-4 p-3 bg-gray-700/50 border border-gray-600 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium">{selectedApplications.length} application(s) selected</span>
            <div className="space-x-2">
              <Button size="sm" onClick={() => handleBulkUpdate(ApplicationStatus.APPROVED)} className="bg-green-600 hover:bg-green-700 focus:ring-green-500">
                <CheckCircle className="h-4 w-4 mr-2" /> Approve Selected
              </Button>
              <Button size="sm" onClick={() => handleBulkUpdate(ApplicationStatus.REJECTED)} className="bg-red-600 hover:bg-red-700 focus:ring-red-500">
                <XCircle className="h-4 w-4 mr-2" /> Reject Selected
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && <TableHead className="w-12">
                 <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-orange-600 focus:ring-orange-500 focus:ring-offset-gray-800"
                  onChange={handleSelectAll}
                  aria-label="Select all pending applications"
                  disabled={pendingAppIdsInView.length === 0}
                  title={pendingAppIdsInView.length > 0 ? "Select all pending applications" : "No pending applications to select"}
                />
              </TableHead>}
              <TableHead>Business Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Submitted On</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedApplications.map((app) => (
              <TableRow key={app.id} className={selectedApplications.includes(app.id) ? 'bg-orange-600/10' : ''}>
                {canManage && <TableCell>
                  {app.status === ApplicationStatus.PENDING && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-orange-600 focus:ring-orange-500 focus:ring-offset-gray-800"
                      checked={selectedApplications.includes(app.id)}
                      onChange={() => handleSelect(app.id)}
                      aria-label={`Select application from ${app.businessName}`}
                    />
                  )}
                </TableCell>}
                <TableCell>
                  <div className="font-medium">{app.businessName}</div>
                  <div className="text-xs text-gray-400">KRA: {app.kraPin}</div>
                </TableCell>
                 <TableCell>
                  <div>{app.contactName}</div>
                  <div className="text-xs text-gray-400">{app.contactEmail}</div>
                </TableCell>
                <TableCell>{new Date(app.submittedAt).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start space-y-1 text-sm">
                    {app.certOfIncUrl && (
                      <a 
                        href={`${DOCS_BASE_URL}${app.certOfIncUrl}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="View Certificate of Incorporation"
                        className="inline-flex items-center text-orange-400 hover:text-orange-300 hover:underline"
                      >
                        <FileText className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        <span>Certificate of Inc.</span>
                      </a>
                    )}
                    {app.cr12Url && (
                       <a 
                        href={`${DOCS_BASE_URL}${app.cr12Url}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="View CR12 Document"
                        className="inline-flex items-center text-orange-400 hover:text-orange-300 hover:underline"
                      >
                        <FileText className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        <span>CR12 Document</span>
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(app.status)}</TableCell>
                {canManage && <TableCell>
                  {app.status === ApplicationStatus.PENDING ? (
                    <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(app.id, ApplicationStatus.APPROVED)} className="text-gray-300 hover:text-green-400">
                            <CheckCircle className="h-4 w-4 mr-1 text-green-500"/> Approve
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(app.id, ApplicationStatus.REJECTED)} className="text-gray-300 hover:text-red-400">
                            <XCircle className="h-4 w-4 mr-1 text-red-500"/> Reject
                        </Button>
                    </div>
                  ) : (
                      <span className="text-xs text-gray-500">Actioned</span>
                  )}
                </TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
        />
      </>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">B2B Account Management</h1>
      <Card>
        <CardHeader>
          <CardTitle>Wholesale Applications</CardTitle>
          <CardDescription>Review and approve or reject new business account registrations.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Input
                placeholder="Search by name, email, KRA PIN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-grow"
              />
              <Select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full sm:w-48"
                aria-label="Filter by status"
              >
                <option value="All">All Statuses</option>
                <option value={ApplicationStatus.PENDING}>Pending</option>
                <option value={ApplicationStatus.APPROVED}>Approved</option>
                <option value={ApplicationStatus.REJECTED}>Rejected</option>
              </Select>
            </div>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default B2BManagement;