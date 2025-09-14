import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import Button from '../components/ui/Button.tsx';
import Select from '../components/ui/Select.tsx';
import Pagination from '../components/ui/Pagination.tsx';
import Modal from '../components/ui/Modal.tsx';
import { Printer, Eye, LoaderCircle, AlertTriangle, Download } from 'lucide-react';
import { Invoice, InvoiceStatus, Branch } from '@masuma-ea/types';
import { getInvoices, getInvoiceDetails } from '../services/api.ts';
import toast from 'react-hot-toast';
import InvoicePrint from '../components/InvoicePrint.tsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDataStore } from '../store/dataStore.ts';

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const getStatusBadge = (status: InvoiceStatus) => {
  let badgeClasses = '';
  switch (status) {
    case InvoiceStatus.UNPAID:
      badgeClasses = 'bg-yellow-400/10 text-yellow-400 ring-yellow-400/20';
      break;
    case InvoiceStatus.PAID:
      badgeClasses = 'bg-green-500/10 text-green-400 ring-green-500/20';
      break;
    case InvoiceStatus.VOID:
      badgeClasses = 'bg-red-400/10 text-red-400 ring-red-400/30';
      break;
    default:
      badgeClasses = 'bg-gray-400/10 text-gray-400 ring-gray-400/20';
      break;
  }
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${badgeClasses}`}>{status}</span>;
};


const Invoices: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const { appSettings } = useDataStore();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // View/Print Modal state
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
    const [isPrintView, setIsPrintView] = useState(false);

    // Filters and pagination
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'All'>('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                setLoading(true);
                const data = await getInvoices(statusFilter === 'All' ? undefined : statusFilter);
                setInvoices(data);
                setError(null);
            } catch (err) {
                setError("Failed to load invoices.");
                toast.error("Failed to load invoices.");
            } finally {
                setLoading(false);
            }
        };
        fetchInvoices();
    }, [statusFilter]);
    
    useEffect(() => {
        if (isPrintView && viewingInvoice) {
            setTimeout(() => {
                 window.print();
                 setIsPrintView(false); // Reset after printing
            }, 500); // Small delay to ensure content is rendered
        }
    }, [isPrintView, viewingInvoice]);

    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        const convertedAmount = amount * rate;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currentCurrency }).format(convertedAmount);
    };

    const handleViewInvoice = async (id: number) => {
        try {
            const details = await getInvoiceDetails(id);
            setViewingInvoice(details);
        } catch (err) {
            toast.error("Failed to load invoice details.");
        }
    };
    
    const handleDownloadPdf = async () => {
        const element = document.getElementById('invoice-preview-content');
        if (!element || !viewingInvoice) return;
        
        const toastId = toast.loading('Generating PDF...', { duration: 5000 });
        
        try {
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps= pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Invoice-${viewingInvoice.invoice_no}.pdf`);
            toast.success('PDF downloaded!', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate PDF.', { id: toastId });
        }
    };

    const paginatedInvoices = invoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        }
        if (error) {
            return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        }
        if (invoices.length === 0) {
            return <div className="text-center p-8 text-gray-400">No invoices found for this filter.</div>;
        }

        return (
            <>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedInvoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-mono">{invoice.invoice_no}</TableCell>
                                <TableCell>{invoice.customerName}</TableCell>
                                <TableCell>{new Date(invoice.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(invoice.totalAmount || 0)}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice.id)}>
                                        <Eye className="h-4 w-4 mr-1" /> View
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(invoices.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                />
            </>
        );
    };

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Invoices</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Invoice Records</CardTitle>
                        <CardDescription>View, print, and manage all customer invoices.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-end mb-4">
                            <Select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="w-full sm:w-48"
                                aria-label="Filter by status"
                            >
                                <option value="All">All Statuses</option>
                                <option value={InvoiceStatus.UNPAID}>Unpaid</option>
                                <option value={InvoiceStatus.PAID}>Paid</option>
                                <option value={InvoiceStatus.VOID}>Void</option>
                            </Select>
                        </div>
                        {renderContent()}
                    </CardContent>
                </Card>
            </div>

            {viewingInvoice && (
                <Modal isOpen={!!viewingInvoice} onClose={() => setViewingInvoice(null)} title={`Invoice Details: ${viewingInvoice.invoice_no}`} className="max-w-4xl">
                    <div className="flex space-x-2 mb-4">
                        <Button onClick={() => setIsPrintView(true)} variant="secondary">
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                        <Button onClick={handleDownloadPdf}>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                    </div>
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50 max-h-[70vh] overflow-y-auto">
                        <div id="invoice-preview-content">
                            <InvoicePrint invoice={viewingInvoice} appSettings={appSettings} isPreview={true} />
                        </div>
                    </div>
                </Modal>
            )}

            {isPrintView && <InvoicePrint invoice={viewingInvoice} appSettings={appSettings} />}
        </>
    );
};

export default Invoices;