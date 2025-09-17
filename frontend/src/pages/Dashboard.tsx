import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
// FIX: Remove .tsx and .ts file extensions from imports for proper module resolution.
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { DollarSign, ShoppingCart, Users, Truck, LoaderCircle, AlertTriangle, Pencil, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// FIX: Removed .ts extension for proper module resolution.
import { getDashboardStats, updateSalesTarget, getSalesChartData, getFastMovingProducts } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import DateRangePicker from '../components/ui/DateRangePicker';
import { DashboardStats, SalesChartDataPoint, Branch, FastMovingProduct } from '@masuma-ea/types';

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const ProgressBar: React.FC<{ value: number, max: number }> = ({ value, max }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
                className="bg-orange-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(percentage, 100)}%` }}
            ></div>
        </div>
    );
};

const formatDate = (d: Date) => d.toISOString().split('T')[0];

const Dashboard: React.FC = () => {
  const { currentBranch, currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesChartData, setSalesChartData] = useState<SalesChartDataPoint[]>([]);
  const [fastMovingProducts, setFastMovingProducts] = useState<FastMovingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [newTarget, setNewTarget] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    return { start: formatDate(startDate), end: formatDate(endDate) };
  });


  useEffect(() => {
    const fetchData = async () => {
      if (!currentBranch) return; // Don't fetch until branch is loaded
      try {
        setLoading(true);
        setError(null);
        const [statsData, chartData, fastMovingData] = await Promise.all([
          getDashboardStats(dateRange, currentBranch.id),
          getSalesChartData(dateRange, currentBranch.id),
          getFastMovingProducts(dateRange, currentBranch.id),
        ]);
        setStats(statsData);
        setSalesChartData(chartData);
        setFastMovingProducts(fastMovingData);

        if (stats === null) {
          setNewTarget(statsData.salesTarget.toString());
        }
      } catch (err) {
        setError('Failed to load dashboard data for the selected range.');
        toast.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange, currentBranch]);

  const formatCurrency = (amount: number) => {
    const rate = exchangeRates[currentCurrency] || 1;
    const convertedAmount = amount * rate;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
    }).format(convertedAmount);
  };
  
  const handleUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetValue = parseFloat(newTarget);
    if (isNaN(targetValue) || targetValue < 0) {
        toast.error("Please enter a valid target amount.");
        return;
    }
    try {
        const data = await updateSalesTarget(targetValue);
        setStats(prevStats => prevStats ? { ...prevStats, salesTarget: data.salesTarget } : null);
        setShowTargetModal(false);
        toast.success('Sales target updated successfully!');
    } catch (err) {
        toast.error("Failed to update sales target.");
    }
  };

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
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
              <p className="text-xs text-gray-400">
                  {currentCurrency !== 'KES' && `(KES ${(stats?.totalRevenue || 0).toLocaleString()}) `}
                  in selected period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Sales</CardTitle>
              <ShoppingCart className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{stats?.totalSales.toLocaleString()}</div>
              <p className="text-xs text-gray-400">in selected period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Active Customers</CardTitle>
              <Users className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{stats?.activeCustomers}</div>
              <p className="text-xs text-gray-400">in selected period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Shipments</CardTitle>
              <Truck className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalShipments}</div>
              <p className="text-xs text-gray-400">{stats?.pendingShipments} pending</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
                <CardDescription>A summary of sales and revenue for the selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                      <XAxis dataKey="name" stroke="#888888" tickFormatter={(dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} />
                      <YAxis stroke="#888888" tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          color: '#f3f4f6',
                        }}
                        formatter={(value: number, name: string) => name === 'revenue' ? formatCurrency(value) : value}
                      />
                      <Legend />
                      <Bar dataKey="sales" fill="#f97316" name="Sales" />
                      <Bar dataKey="revenue" fill="#ea580c" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Fast-Moving Products</CardTitle>
                    <CardDescription>Top 10 sellers in this period.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {fastMovingProducts.map(p => (
                            <li key={p.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-medium text-gray-200">{p.name}</p>
                                    <p className="text-xs text-gray-400">{p.totalSold} units sold</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">{p.currentStock} in stock</p>
                                    {p.currentStock < 10 && <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Low Stock</span>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle>Sales Target Progress</CardTitle>
                  <CardDescription>Your progress towards this period's sales goal.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowTargetModal(true)}>
                  <Pencil className="w-4 h-4 mr-2"/> Edit Target
              </Button>
          </CardHeader>
          <CardContent>
              <div className="space-y-2">
                  <ProgressBar value={stats?.totalRevenue || 0} max={stats?.salesTarget || 0} />
                  <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-200">{formatCurrency(stats?.totalRevenue || 0)}</span>
                      <span className="text-gray-400">Target: <span className="text-orange-400">{formatCurrency(stats?.salesTarget || 0)}</span></span>
                  </div>
              </div>
          </CardContent>
        </Card>

      </>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <DateRangePicker range={dateRange} onRangeChange={setDateRange} />
      </div>

      {renderContent()}

    </div>

    {showTargetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Set Sales Target</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowTargetModal(false)}><X className="h-5 w-5"/></Button>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdateTarget} className="space-y-4">
                    <Input
                        label="Sales Target (KES)"
                        type="number"
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        placeholder="e.g., 5000000"
                        required
                    />
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="secondary" type="button" onClick={() => setShowTargetModal(false)}>Cancel</Button>
                        <Button type="submit">Save Target</Button>
                    </div>
                </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default Dashboard;
