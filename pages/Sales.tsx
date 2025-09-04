import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Input from '../components/ui/Input';
import Pagination from '../components/ui/Pagination';
import { LoaderCircle, AlertTriangle } from 'lucide-react';
// FIX: Explicitly add file extension to assist module resolver.
import { Sale, Customer, Branch } from '../types.ts';
import { getSales, getCustomers } from '../services/api';
import DateRangePicker from '../components/ui/DateRangePicker';

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const formatDate = (d: Date) => d.toISOString().split('T')[0];

const Sales: React.FC = () => {
  const { currentBranch, currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    return { start: formatDate(startDate), end: formatDate(endDate) };
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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

  const formatCurrency = (amount: number) => {
    const rate = exchangeRates[currentCurrency] || 1;
    const convertedAmount = amount * rate;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
    }).format(convertedAmount);
  };

  const filteredSales = useMemo(() => {
      let branchSales = sales.filter(sale => sale.branch_id === currentBranch.id);
      if (searchTerm) {
          const lowercasedTerm = searchTerm.toLowerCase();
          branchSales = branchSales.filter(sale => 
              sale.sale_no.toLowerCase().includes(lowercasedTerm) ||
              (customerMap[sale.customer_id] || '').toLowerCase().includes(lowercasedTerm)
          );
      }
      return branchSales;
  }, [sales, searchTerm, currentBranch, customerMap]);
  
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, dateRange]);
  
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
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Amount ({currentCurrency})</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-mono">{sale.sale_no}</TableCell>
                <TableCell>{customerMap[sale.customer_id] || 'Unknown'}</TableCell>
                <TableCell>{new Date(sale.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-center">{typeof sale.items === 'number' ? sale.items : (Array.isArray(sale.items) ? sale.items.length : 0)}</TableCell>
                <TableCell className="font-semibold text-right">{formatCurrency(sale.amount || 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Sales History</h1>
        <p className="text-gray-400 mt-2 md:mt-0">Branch: <span className="font-semibold text-orange-500">{currentBranch.name}</span></p>
      </div>
      
      <DateRangePicker onRangeChange={setDateRange} initialRange={dateRange} />
      
      <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>A complete log of all sales transactions for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="mb-4">
                <Input 
                    placeholder="Search by Sale No. or Customer Name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
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
  );
};

export default Sales;