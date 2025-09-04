import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
// FIX: Changed import path for `types` to allow module resolution by removing the file extension.
import { Branch, Sale, Customer, ShippingLabel, ShippingStatus, SaleItem } from '@masuma-ea/types';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { DollarSign, ShoppingCart, Users, Truck, LoaderCircle, AlertTriangle } from 'lucide-react';
import { getSales, getCustomers, getShipments } from '../services/api';
import DateRangePicker from '../components/ui/DateRangePicker';

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
  const { currentBranch, currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // getCustomers doesn't need date range, it's a lookup table for names
        const [salesData, customersData, shipmentsData] = await Promise.all([
          getSales(dateRange),
          getCustomers(),
          getShipments(dateRange)
        ]);
        setSales(salesData);
        setCustomers(customersData);
        setShipments(shipmentsData);
      } catch (err) {
        setError("Failed to load report data for the selected range.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const formatCurrency = (amount: number) => {
    const rate = exchangeRates[currentCurrency] || 1;
    const convertedAmount = amount * rate;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(convertedAmount);
  };

  // Filter data based on current branch
  const branchSales = sales.filter(sale => sale.branch_id === currentBranch.id);
  const branchCustomerIds = new Set(branchSales.map(sale => sale.customer_id));
  const totalRevenue = branchSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
  const totalSales = branchSales.length;
  const uniqueCustomers = branchCustomerIds.size;

  const branchShipments = shipments.filter(label => label.from_branch_id === currentBranch.id);
  const totalShipments = branchShipments.length;
  const pendingShipments = branchShipments.filter(l => l.status === ShippingStatus.DRAFT).length;
  
  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-64"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    }
  
    if (error) {
      return <div className="flex justify-center items-center h-64 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
    }

    return (
      <>
        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Total Revenue</CardTitle>
              <DollarSign className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-gray-400">
                  {currentCurrency !== 'KES' && `(KES ${totalRevenue.toLocaleString()}) `}
                  From {totalSales} sales
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Total Sales</CardTitle>
              <ShoppingCart className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales}</div>
              <p className="text-xs text-gray-400">In this branch</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Customer Activity</CardTitle>
              <Users className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueCustomers}</div>
              <p className="text-xs text-gray-400">Unique customers</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Shipments</CardTitle>
              <Truck className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalShipments}</div>
              <p className="text-xs text-gray-400">{pendingShipments} pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Report</CardTitle>
            <CardDescription>A list of sales transactions in this branch for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount ({currentCurrency})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchSales.length > 0 ? branchSales.slice(0, 25).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono">{sale.sale_no}</TableCell>
                      <TableCell>{customers.find(c => c.id === sale.customer_id)?.name || 'Unknown'}</TableCell>
                      <TableCell>{new Date(sale.created_at).toLocaleString()}</TableCell>
                      {/* FIX: Render the number of items. The 'items' property can be a number (count) or an array (full data). */}
                      <TableCell className="text-center">{typeof sale.items === 'number' ? sale.items : (Array.isArray(sale.items) ? sale.items.length : 0)}</TableCell>
                      <TableCell className="font-semibold text-right">
                          <div>{formatCurrency(sale.amount || 0)}</div>
                          {currentCurrency !== 'KES' && (
                              <div className="text-xs text-gray-400 font-normal">
                                  KES {(sale.amount || 0).toLocaleString()}
                              </div>
                          )}
                      </TableCell>
                    </TableRow>
                  )) : (
                      <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                              No sales data available for this branch in the selected period.
                          </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
        
        {/* Recent Shipments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Shipments Report</CardTitle>
            <CardDescription>A list of shipments from this branch for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchShipments.length > 0 ? branchShipments.slice(0, 25).map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-mono">{shipment.id}</TableCell>
                      <TableCell>{shipment.to_name}</TableCell>
                      <TableCell>{new Date(shipment.created_at).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                    </TableRow>
                  )) : (
                      <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                              No shipment data available for this branch in the selected period.
                          </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-gray-400 mt-2 md:mt-0">Showing data for: <span className="font-semibold text-orange-500">{currentBranch.name}</span></p>
      </div>
      
      <DateRangePicker onRangeChange={setDateRange} initialRange={dateRange} />

      {renderContent()}

    </div>
  );
};

export default Reports;