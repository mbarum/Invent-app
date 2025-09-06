



import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Branch, Sale, Customer, ShippingLabel, ShippingStatus } from '@masuma-ea/types';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import { DollarSign, ShoppingCart, Users, Truck, LoaderCircle, AlertTriangle, Download } from 'lucide-react';
import { getSales, getCustomers, getShipments } from '../services/api.ts';
import DateRangePicker from '../components/ui/DateRangePicker.tsx';
import toast from 'react-hot-toast';
import Pagination from '../components/ui/Pagination.tsx';
import Button from '../components/ui/Button.tsx';

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

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const formatDate = (d: Date) => d.toISOString().split('T')[0];

const Reports: React.FC = () => {
  const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shipments, setShipments] = useState<ShippingLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    return { start: formatDate(startDate), end: formatDate(endDate) };
  });

  const [salesPage, setSalesPage] = useState(1);
  const [shipmentsPage, setShipmentsPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [salesData, customersData, shipmentsData] = await Promise.all([
          getSales(dateRange),
          getCustomers(),
          getShipments(dateRange)
        ]);
        setSales(salesData);
        setCustomers(customersData);
        setShipments(shipmentsData);
      } catch (err) {
        setError("Failed to load reports data.");
        toast.error("Failed to load reports data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const customerMap = useMemo(() => customers.reduce((acc, customer) => {
      acc[customer.id] = customer.name;
      return acc;
  }, {} as Record<number, string>), [customers]);

  const formatCurrency = (amount: number) => {
    const rate = exchangeRates[currentCurrency] || 1;
    const convertedAmount = amount * rate;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
    }).format(convertedAmount);
  };

  const stats = useMemo(() => {
      const totalRevenue = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
      const activeCustomers = new Set(sales.map(s => s.customer_id)).size;
      return { totalRevenue, totalSales: sales.length, activeCustomers, totalShipments: shipments.length };
  }, [sales, shipments]);

  const handleExportSales = () => {
    const data = sales.map(s => ({ ...s, customerName: customerMap[s.customer_id] || 'N/A' }));
    exportToCsv(`sales_report_${dateRange.start}_to_${dateRange.end}`, ['Sale No', 'Customer', 'Date', 'Amount (KES)'], data, ['sale_no', 'customerName', 'created_at', 'amount']);
  };
  
  const handleExportShipments = () => {
    exportToCsv(`shipments_report_${dateRange.start}_to_${dateRange.end}`, ['Order Ref', 'Customer', 'Date', 'Status'], shipments, ['id', 'to_name', 'created_at', 'status']);
  };

  const paginatedSales = sales.slice((salesPage - 1) * itemsPerPage, salesPage * itemsPerPage);
  const paginatedShipments = shipments.slice((shipmentsPage - 1) * itemsPerPage, shipmentsPage * itemsPerPage);

  if (loading) {
      return <div className="flex justify-center items-center h-64"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }
  if (error) {
      return <div className="flex justify-center items-center h-64 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>
      <DateRangePicker range={dateRange} onRangeChange={setDateRange} />
      
      <Card>
        <CardHeader>
            <CardTitle>Period Summary</CardTitle>
            <CardDescription>An overview of key metrics for the selected date range.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-orange-500/10 text-orange-500"><DollarSign className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-orange-500/10 text-orange-500"><ShoppingCart className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-gray-400">Total Sales</p>
                    <p className="text-2xl font-bold">{stats.totalSales.toLocaleString()}</p>
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-orange-500/10 text-orange-500"><Users className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-gray-400">Active Customers</p>
                    <p className="text-2xl font-bold">{stats.activeCustomers.toLocaleString()}</p>
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-orange-500/10 text-orange-500"><Truck className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-gray-400">Total Shipments</p>
                    <p className="text-2xl font-bold">{stats.totalShipments.toLocaleString()}</p>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Sales Report</CardTitle></div>
                <Button variant="secondary" size="sm" onClick={handleExportSales}><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader><TableRow>
                          <TableHead>Sale No.</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                          {paginatedSales.map(sale => (
                              <TableRow key={sale.id}>
                                  <TableCell className="font-mono">{sale.sale_no}</TableCell>
                                  <TableCell>{customerMap[sale.customer_id] || 'N/A'}</TableCell>
                                  <TableCell className="text-right font-semibold">{formatCurrency(sale.amount || 0)}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                  <Pagination currentPage={salesPage} totalPages={Math.ceil(sales.length / itemsPerPage)} onPageChange={setSalesPage} />
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Shipments Report</CardTitle></div>
                <Button variant="secondary" size="sm" onClick={handleExportShipments}><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
              </CardHeader>
              <CardContent>
                   <Table>
                      <TableHeader><TableRow>
                          <TableHead>Order Ref</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                           {paginatedShipments.map(shipment => (
                              <TableRow key={shipment.id}>
                                  <TableCell className="font-mono">{shipment.sale_id ? `SALE-${shipment.sale_id}` : `INV-${shipment.invoice_id}`}</TableCell>
                                  <TableCell>{shipment.to_name}</TableCell>
                                  <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                  <Pagination currentPage={shipmentsPage} totalPages={Math.ceil(shipments.length / itemsPerPage)} onPageChange={setShipmentsPage} />
              </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default Reports;