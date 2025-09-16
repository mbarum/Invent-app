import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import Input from '../components/ui/Input.tsx';
import Pagination from '../components/ui/Pagination.tsx';
import { LoaderCircle, AlertTriangle, Download, Eye, Printer } from 'lucide-react';
import { Sale, Customer, Branch } from '@masuma-ea/types';
import { getSales, getCustomers, getSaleDetails } from '../services/api.ts';
import DateRangePicker from '../components/ui/DateRangePicker.tsx';
import Button from '../components/ui/Button.tsx';
import { useDataStore } from '../store/dataStore.ts';
import Select from '../components/ui/Select.tsx';
import Modal from '../components/ui/Modal.tsx';
import ReceiptPrint from '../components/ReceiptPrint.tsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const formatDate = (d: Date) => d.toISOString().split('T')[0];

const exportToCsv = (filename: string, headers: string[], data: any[], keys: string[]) => {
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            keys.map(key => {
                let value = key.split('.').reduce((o, i) => o ? o[i] : '', row);
                if (typeof value === 'string') {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


const Sales: React.FC = () => {
  const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { branches } = useDataStore(); // Get branches from the global store
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    return { start: formatDate(startDate), end: formatDate(endDate) };
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [salesData, customersData] = await Promise.all([
          getSales(dateRange),
          getCustomers(),
        ]);
        setSales(salesData);
        setCustomers(customersData);
      } catch (err) {
        setError("Failed to load sales data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const customerMap = useMemo(() => {
      return customers.reduce((acc, customer) => {
          acc[customer.id] = customer.name;
          return acc;
      }, {} as Record<number, string>);
  }, [customers]);

  const branchMap = useMemo(() => {
      return branches.reduce((acc, branch) => {
          acc[branch.id] = branch.name;
          return acc;
      }, {} as Record<number, string>);
  }, [branches]);

  const formatCurrency = (amount: number) => {
    const rate = exchangeRates[currentCurrency] || 1;
    const convertedAmount = amount * rate;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
    }).format(convertedAmount);
  };
  
  const handleViewReceipt = async (sale: Sale) => {
    try {
        const detailedSale = await getSaleDetails(sale.id);
        setViewingSale(detailedSale);
        setIsReceiptModalOpen(true);
    } catch (err) {
        toast.error("Failed to load receipt details.");
    }
  };
  
  const handleDownloadPdf = async () => {
    const element = document.getElementById('receipt-to-print');
    if (!element || !viewingSale) return;
    const toastId = toast.loading('Generating PDF...', { duration: 5000 });
    try {
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: null });
        const imgData = canvas.toDataURL('image/png');
        // Using a custom page size for the small receipt
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, 200] // Approximate thermal receipt paper size
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Receipt-${viewingSale.saleNo}.pdf`);
        toast.success('PDF downloaded!', { id: toastId });
    } catch (error) {
        console.error(error);
        toast.error('Failed to generate PDF.', { id: toastId });
    }
  };

  const handlePrintReceipt = () => {
    if (viewingSale) {
        window.print();
    }
  };


  const filteredSales = useMemo(() => {
      let allSales = [...sales];
      
      if (selectedCustomerId !== 'All') {
          allSales = allSales.filter(sale => sale.customerId === parseInt(selectedCustomerId, 10));
      }

      if (searchTerm) {
          const lowercasedTerm = searchTerm.toLowerCase();
          allSales = allSales.filter(sale => 
              sale.saleNo.toLowerCase().includes(lowercasedTerm) ||
              (customerMap[sale.customerId] || '').toLowerCase().includes(lowercasedTerm) ||
              (branchMap[sale.branchId] || '').toLowerCase().includes(lowercasedTerm)
          );
      }
      return allSales;
  }, [sales, searchTerm, customerMap, branchMap, selectedCustomerId]);
  
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, dateRange, selectedCustomerId]);

  const handleExport = () => {
    const data = filteredSales.map(s => ({
        ...s,
        customerName: customerMap[s.customerId] || 'N/A',
        branchName: branchMap[s.branchId] || 'N/A'
    }));
    exportToCsv(`sales_history_${dateRange.start}_to_${dateRange.end}`, ['Sale No', 'Customer', 'Branch', 'Date', 'Amount (KES)', 'Payment Method'], data, ['saleNo', 'customerName', 'branchName', 'createdAt', 'totalAmount', 'paymentMethod']);
  };
  
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderContent = () => {
    if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
    if (sales.length > 0 && paginatedSales.length === 0) return <div className="text-center p-8 text-gray-400">No sales found matching your criteria.</div>;

    return (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Amount ({currentCurrency})</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-mono">{sale.saleNo}</TableCell>
                <TableCell>{customerMap[sale.customerId] || 'Unknown'}</TableCell>
                <TableCell>{branchMap[sale.branchId] || 'Unknown'}</TableCell>
                <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                <TableCell className="text-center">{sale.itemCount || 0}</TableCell>
                <TableCell className="font-semibold text-right">{formatCurrency(sale.totalAmount || 0)}</TableCell>
                <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleViewReceipt(sale)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
    );
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales History</h1>
          <p className="text-gray-400 mt-1">A log of all sales transactions across all branches.</p>
        </div>
        <Button onClick={handleExport} variant="secondary"><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>
      
      <DateRangePicker range={dateRange} onRangeChange={setDateRange} />
      
      <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>A complete log of all sales transactions for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Input 
                    placeholder="Search by Sale No, Customer or Branch Name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-grow"
                />
                 <Select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full sm:w-64"
                    aria-label="Filter by customer"
                >
                    <option value="All">All Customers</option>
                    {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                            {customer.name}
                        </option>
                    ))}
                </Select>
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

    <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title={`Receipt: ${viewingSale?.saleNo}`}>
        <div className="flex space-x-2 mb-4 no-print">
            <Button onClick={handlePrintReceipt} variant="secondary" className="w-full"><Printer className="mr-2 h-4 w-4" /> Print Receipt</Button>
            <Button onClick={handleDownloadPdf} className="w-full"><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
        </div>
        <div id="receipt-to-print" className="border border-gray-700 rounded-md p-2 bg-gray-900">
            <ReceiptPrint sale={viewingSale} />
        </div>
    </Modal>
    <div className="hidden print:block">
        <ReceiptPrint sale={viewingSale} />
    </div>
    </>
  );
};

export default Sales;