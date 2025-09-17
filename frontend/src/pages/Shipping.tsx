import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
import { PlusCircle, Printer, X, LoaderCircle } from 'lucide-react';
import { ShippingLabel, ShippingStatus, Branch, Customer } from '@masuma-ea/types';
import ShippingLabelPrint from '../components/ShippingLabelPrint';
// FIX: Removed .ts extension for proper module resolution.
import { getBranches, createShippingLabel, updateShippingLabelStatus, getInvoiceDetails } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/permissions';
import { useDataStore } from '../store/dataStore';

const getStatusBadge = (status: ShippingStatus) => {
  switch (status) {
    case ShippingStatus.DRAFT:
      return <span className="px-2 py-1 text-xs font-medium text-yellow-200 bg-yellow-900 rounded-full">{status}</span>;
    case ShippingStatus.PRINTED:
      return <span className="px-2 py-1 text-xs font-medium text-blue-200 bg-blue-900 rounded-full">{status}</span>;
    case ShippingStatus.SHIPPED:
      return <span className="px-2 py-1 text-xs font-medium text-green-200 bg-green-900 rounded-full">{status}</span>;
    default:
      return <span className="px-2 py-1 text-xs font-medium text-gray-200 bg-gray-700 rounded-full">{status}</span>;
  }
};

const Shipping: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManageShipping = hasPermission(PERMISSIONS.MANAGE_SHIPPING);
  
  const { sales, legacyInvoices: invoices, shippingLabels: labels, customers, isInitialDataLoaded } = useDataStore();
  const [localLabels, setLocalLabels] = useState<ShippingLabel[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [labelToPrint, setLabelToPrint] = useState<ShippingLabel | null>(null);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a5'>('thermal');
  const [formData, setFormData] = useState<Partial<ShippingLabel>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => {
    // Sync labels from the store to local state, allowing for local updates
    setLocalLabels(labels);
    if(isInitialDataLoaded) {
      setLoading(false);
    }
  }, [labels, isInitialDataLoaded]);

  useEffect(() => {
    if (labelToPrint) {
      // A small delay ensures the component has time to render with the new label data
      // before the print dialog is triggered.
      setTimeout(() => {
        window.print();
        // Resetting after print dialog is shown/closed
        setLabelToPrint(null);
      }, 500);
    }
  }, [labelToPrint]);
  
  const getOrderRef = (label: ShippingLabel) => label.saleId ? `SALE-${label.saleId}` : `INV-${label.invoiceId}`;

  const filteredLabels = localLabels
    .filter(label => statusFilter === 'All' || label.status === statusFilter)
    .filter(label => {
        const term = searchTerm.toLowerCase();
        const orderRef = getOrderRef(label).toLowerCase();
        return (
            label.id.toLowerCase().includes(term) ||
            orderRef.includes(term) ||
            label.toName.toLowerCase().includes(term)
        )
    });

  const totalPages = Math.ceil(filteredLabels.length / itemsPerPage);
  const paginatedLabels = filteredLabels.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, statusFilter]);


  const handleCreateLabel = () => {
    setFormData({});
    setShowModal(true);
  };
  
  const handleAutoFill = async (type: 'sale' | 'invoice', id: string) => {
    const numericId = parseInt(id);
    if (!numericId) {
        setFormData(prev => ({ ...prev, fromBranchId: undefined, toCustomerId: undefined, fromName: '', fromAddress: '', fromPhone: '', toName: '', toAddress: '', toPhone: '' }));
        return;
    }

    try {
        let branch: Branch | undefined;
        let customer: Customer | undefined;
        let sourceSaleId: number | undefined;
        let sourceInvoiceId: number | undefined;

        if (type === 'sale') {
            const sale = sales.find(s => s.id === numericId);
            if (!sale) { toast.error("Sale details not found."); return; }
            const branchesData = await getBranches(); // Still might need to fetch this if not in store
            branch = branchesData.find(b => b.id === sale.branchId);
            customer = customers.find(c => c.id === sale.customerId);
            sourceSaleId = sale.id;
        } else { // type === 'invoice'
            const invoiceDetails = await getInvoiceDetails(numericId);
            branch = invoiceDetails.branch;
            customer = invoiceDetails.customer;
            sourceInvoiceId = invoiceDetails.id;
        }

        if (branch && customer) {
            setFormData(prev => ({
                ...prev, saleId: sourceSaleId, invoiceId: sourceInvoiceId,
                fromBranchId: branch.id, toCustomerId: customer.id,
                fromName: branch.name, fromAddress: branch.address, fromPhone: branch.phone,
                toName: customer.name, toAddress: customer.address, toPhone: customer.phone,
            }));
        } else {
             toast.error("Could not find complete branch or customer details.");
        }
    } catch(err) {
        toast.error("Failed to auto-fill details from selection.");
        console.error(err);
    }
  };
  
  const handleSave = async () => {
      try {
        const newLabel = await createShippingLabel(formData);
        setLocalLabels(prev => [newLabel, ...prev]);
        setShowModal(false);
        toast.success('Shipping label created successfully!');
      } catch (err) {
        toast.error('Failed to create shipping label.');
      }
  }

  const handlePrint = async (label: ShippingLabel, format: 'thermal' | 'a5') => {
    setPrintFormat(format);
    setLabelToPrint(label);
    if (label.status !== ShippingStatus.PRINTED && label.status !== ShippingStatus.SHIPPED) {
       try {
        const updatedLabel = await updateShippingLabelStatus(label.id, ShippingStatus.PRINTED);
        setLocalLabels(localLabels.map(l => l.id === label.id ? updatedLabel : l));
        toast.success('Label status updated to Printed.');
       } catch (err) {
        toast.error('Failed to update label status.');
       }
    }
  };
  
  const handleMarkShipped = async (id: string) => {
    try {
      const updatedLabel = await updateShippingLabelStatus(id, ShippingStatus.SHIPPED);
      setLocalLabels(localLabels.map(l => l.id === id ? updatedLabel : l));
      toast.success('Label marked as Shipped!');
    } catch (err) {
      toast.error('Failed to update label status.');
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    }
    if (localLabels.length > 0 && paginatedLabels.length === 0) {
        return <div className="text-center p-8 text-gray-400">No labels found matching your criteria.</div>;
    }
    return (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label ID</TableHead>
              <TableHead>Order Ref</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              {canManageShipping && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLabels.map((label) => (
              <TableRow key={label.id}>
                <TableCell className="font-mono">{label.id}</TableCell>
                <TableCell>{getOrderRef(label)}</TableCell>
                <TableCell>{label.toName}</TableCell>
                <TableCell>{getStatusBadge(label.status)}</TableCell>
                <TableCell>{new Date(label.createdAt).toLocaleString()}</TableCell>
                {canManageShipping && (
                  <TableCell className="space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handlePrint(label, 'thermal')}><Printer className="h-4 w-4 mr-1"/> Thermal</Button>
                    <Button variant="ghost" size="sm" onClick={() => handlePrint(label, 'a5')}><Printer className="h-4 w-4 mr-1"/> A5</Button>
                    {label.status !== ShippingStatus.SHIPPED && (
                      <Button variant="secondary" size="sm" onClick={() => handleMarkShipped(label.id)}>Mark Shipped</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Shipping Labels</h1>
          {canManageShipping && (
            <Button onClick={handleCreateLabel}>
              <PlusCircle className="mr-2 h-5 w-5" /> Create Shipping Label
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
             <div className="p-4 border-b border-gray-700">
               <div className="flex flex-col sm:flex-row gap-4">
                  <Input 
                      placeholder="Search by Label ID, Order Ref, Customer..."
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
                      <option value={ShippingStatus.DRAFT}>Draft</option>
                      <option value={ShippingStatus.PRINTED}>Printed</option>
                      <option value={ShippingStatus.SHIPPED}>Shipped</option>
                  </Select>
              </div>
            </div>
            {renderContent()}
            <div className="p-4 border-t border-gray-700">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
          </CardContent>
        </Card>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>New Shipping Label</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}><X className="h-5 w-5"/></Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Create from Sale" onChange={e => handleAutoFill('sale', e.target.value)}>
                    <option value="">Select a Sale...</option>
                    {sales.map(s => <option key={s.id} value={s.id}>{s.saleNo}</option>)}
                </Select>
                <Select label="Create from Invoice" onChange={e => handleAutoFill('invoice', e.target.value)}>
                    <option value="">Select an Invoice...</option>
                    {invoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNo}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h4 className="font-semibold mb-2">FROM</h4>
                  <Input label="Name" value={formData.fromName || ''} readOnly />
                  <Input label="Address" value={formData.fromAddress || ''} readOnly />
                  <Input label="Phone" value={formData.fromPhone || ''} readOnly />
                </div>
                 <div>
                  <h4 className="font-semibold mb-2">TO</h4>
                  <Input label="Name" value={formData.toName || ''} readOnly />
                  <Input label="Address" value={formData.toAddress || ''} readOnly />
                  <Input label="Phone" value={formData.toPhone || ''} readOnly />
                </div>
              </div>
               <div className="grid grid-cols-2 gap-4">
                <Input label="Carrier" placeholder="e.g., G4S, Wells Fargo" value={formData.carrier || ''} onChange={e => setFormData({...formData, carrier: e.target.value})}/>
                <Input label="Weight (kg)" type="number" placeholder="e.g., 5.2" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})}/>
               </div>
               <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={handleSave}>Save Label</Button>
               </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <ShippingLabelPrint label={labelToPrint} format={printFormat} />
    </>
  );
};

export default Shipping;