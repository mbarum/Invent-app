import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { LoaderCircle, AlertTriangle, ArrowUp, ArrowDown, PlusCircle, History, Download } from 'lucide-react';
// FIX: Import types from the types package and remove extensions from local imports.
import { Customer, CustomerTransactions } from '@masuma-ea/types';
// FIX: Removed .ts extension for proper module resolution.
import { getCustomers, createCustomer, getCustomerTransactions } from '../services/api';
import toast from 'react-hot-toast';
import { useDataStore } from '../store/dataStore';

// Enriched customer data type that extends the base type for component-specific stats
// FIX: Changed from interface extension to type intersection to resolve type inference issues.
type CustomerSegmentData = Customer & {
    totalSpending: number;
    totalOrders: number;
    lastPurchaseDate: Date | null;
};

type NewCustomerData = Omit<Customer, 'id'>;
type SortKey = 'name' | 'totalOrders' | 'totalSpending' | 'lastPurchaseDate';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

interface OutletContextType {
  currentCurrency: string;
  exchangeRates: { [key:string]: number };
}

// --- UTILITY ---
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


const Customers: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const { refetchCustomers } = useDataStore();
    const [customers, setCustomers] = useState<CustomerSegmentData[]>([]);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtering and sorting state
    const [searchTerm, setSearchTerm] = useState('');
    const [spendingFilter, setSpendingFilter] = useState('all');
    const [recencyFilter, setRecencyFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalSpending', direction: 'descending' });
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // Modal states
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
    const [historyCustomer, setHistoryCustomer] = useState<CustomerSegmentData | null>(null);
    const [historyData, setHistoryData] = useState<CustomerTransactions | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [newCustomer, setNewCustomer] = useState<NewCustomerData>({ name: '', phone: '', address: '', kraPin: ''});

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getCustomers({
                    page: currentPage,
                    limit: itemsPerPage,
                    searchTerm,
                    spendingFilter,
                    recencyFilter,
                    sortKey: sortConfig.key,
                    sortDirection: sortConfig.direction,
                });
                setCustomers(data.customers.map(c => ({...c, lastPurchaseDate: c.lastPurchaseDate ? new Date(c.lastPurchaseDate) : null})));
                setTotalCustomers(data.total);
            } catch (err) {
                setError("Failed to load customer data.");
                toast.error("Failed to load customer data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentPage, searchTerm, spendingFilter, recencyFilter, sortConfig]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, spendingFilter, recencyFilter, sortConfig]);

    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        const convertedAmount = amount * rate;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currentCurrency,
        }).format(convertedAmount);
    };

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'descending' ? 'ascending' : 'descending' }));
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setNewCustomer(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createCustomer(newCustomer);
            await refetchCustomers(); // Refetch global list for dropdowns
            // Refetch current page
            const data = await getCustomers({ page: currentPage, limit: itemsPerPage });
            setCustomers(data.customers.map(c => ({...c, lastPurchaseDate: c.lastPurchaseDate ? new Date(c.lastPurchaseDate) : null})));
            setTotalCustomers(data.total);

            setAddModalOpen(false); setNewCustomer({ name: '', phone: '', address: '', kraPin: ''});
            toast.success('Customer added successfully!');
        } catch (err: any) { toast.error(`Failed to add customer: ${err.message}`); }
    };

    const handleViewHistory = async (customer: CustomerSegmentData) => {
        setHistoryCustomer(customer);
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const data = await getCustomerTransactions(customer.id);
            setHistoryData(data);
        } catch (err) { toast.error("Failed to load transaction history."); } 
        finally { setHistoryLoading(false); }
    };
    
    const handleExportCustomers = async () => {
        try {
            // Fetch all customers for export
            const allCustomersData = await getCustomers();
            exportToCsv('customers_export', ['ID', 'Name', 'Phone', 'Address', 'KRA PIN', 'Total Spending (KES)', 'Total Orders', 'Last Purchase Date'], allCustomersData.customers, ['id', 'name', 'phone', 'address', 'kraPin', 'totalSpending', 'totalOrders', 'lastPurchaseDate']);
        } catch(e) {
            toast.error("Failed to export customers.")
        }
    };
    
    const handleExportHistory = () => {
        if (!historyData || !historyCustomer) return;
        const allData = [
            ...historyData.sales.map(s => ({ type: 'Sale', ...s, date: s.createdAt, ref: s.saleNo })),
            ...historyData.invoices.map(i => ({ type: 'Invoice', ...i, date: i.createdAt, ref: i.invoiceNo })),
            ...historyData.quotations.map(q => ({ type: 'Quotation', ...q, date: q.createdAt, ref: q.quotationNo }))
        ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        exportToCsv(`${historyCustomer.name}_history`, ['Type', 'Ref No.', 'Date', 'Amount', 'Status'], allData, ['type', 'ref', 'date', 'totalAmount', 'status']);
    };

    const totalPages = Math.ceil(totalCustomers / itemsPerPage);

    const SortableHeader: React.FC<{ sortKey: SortKey; children: React.ReactNode; className?: string }> = ({ sortKey, children, className }) => (
        <TableHead className={`cursor-pointer hover:bg-gray-700 ${className}`} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center">{children}{sortConfig.key === sortKey && (sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}</div>
        </TableHead>
    );

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        if (totalCustomers > 0 && customers.length === 0) return <div className="text-center p-8 text-gray-400">No customers found matching your criteria.</div>;
        return (<>
            <Table>
                <TableHeader><TableRow>
                    <SortableHeader sortKey="name">Customer Name</SortableHeader>
                    <TableHead>Contact</TableHead>
                    <SortableHeader sortKey="totalOrders" className="text-center">Total Orders</SortableHeader>
                    <SortableHeader sortKey="totalSpending" className="text-right">Total Spending ({currentCurrency})</SortableHeader>
                    <SortableHeader sortKey="lastPurchaseDate">Last Purchase</SortableHeader>
                    <TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {customers.map(customer => (
                        <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell><div>{customer.phone}</div><div className="text-xs text-gray-400">{customer.address}</div></TableCell>
                            <TableCell className="text-center">{customer.totalOrders}</TableCell>
                            <TableCell className="font-semibold text-right"><div>{formatCurrency(customer.totalSpending)}</div>{currentCurrency !== 'KES' && <div className="text-xs text-gray-400 font-normal">KES {customer.totalSpending.toLocaleString()}</div>}</TableCell>
                            <TableCell>{customer.lastPurchaseDate ? customer.lastPurchaseDate.toLocaleDateString() : 'N/A'}</TableCell>
                            <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewHistory(customer)}><History className="h-4 w-4 mr-1"/> History</Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </>
        );
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-3xl font-bold">Customer Management</h1>
                    <div className="flex space-x-2 flex-shrink-0">
                        <Button variant="secondary" onClick={handleExportCustomers}>
                            <Download className="mr-2 h-4 w-4"/> 
                            <span className="hidden sm:inline">Export CSV</span>
                        </Button>
                        <Button onClick={() => setAddModalOpen(true)}>
                            <PlusCircle className="mr-2 h-5 w-5" />
                            <span className="hidden sm:inline">Add Customer</span>
                            <span className="sm:hidden">Add</span>
                        </Button>
                    </div>
                </div>
                <Card><CardHeader><CardTitle>Customer Segmentation</CardTitle><CardDescription>Filter and sort customers based on their activity.</CardDescription></CardHeader><CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input placeholder="Search by name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="md:col-span-1"/>
                        <Select label="Spending Tier" value={spendingFilter} onChange={e => setSpendingFilter(e.target.value)}><option value="all">All Spending Tiers</option><option value="high">High Spenders (&gt; KES 100k)</option><option value="mid">Mid Tier (KES 20k-100k)</option><option value="low">Low Tier (&lt; KES 20k)</option><option value="none">No Purchases</option></Select>
                        <Select label="Recency" value={recencyFilter} onChange={e => setRecencyFilter(e.target.value)}><option value="all">All Recency</option><option value="active">Active (Last 30 days)</option><option value="at_risk">At Risk (31-90 days)</option><option value="inactive">Inactive (&gt; 90 days)</option></Select>
                    </div>
                </CardContent></Card>
                <Card><CardContent className="p-0">{renderContent()}</CardContent></Card>
            </div>
            
            <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Add New Customer">
                <form onSubmit={handleAddCustomer} className="space-y-4">
                    <Input label="Full Name" name="name" value={newCustomer.name} onChange={handleInputChange} required />
                    <Input label="Phone Number" name="phone" type="tel" value={newCustomer.phone} onChange={handleInputChange} required />
                    <Input label="Address" name="address" value={newCustomer.address} onChange={handleInputChange} required />
                    <Input label="KRA PIN (Optional)" name="kraPin" value={newCustomer.kraPin || ''} onChange={handleInputChange} />
                    <div className="flex justify-end space-x-2 pt-2"><Button variant="secondary" type="button" onClick={() => setAddModalOpen(false)}>Cancel</Button><Button type="submit">Save Customer</Button></div>
                </form>
            </Modal>
            
            <Modal isOpen={isHistoryModalOpen} onClose={() => setHistoryModalOpen(false)} title={`History for ${historyCustomer?.name}`} className="max-w-4xl">
                <Button onClick={handleExportHistory} disabled={!historyData || historyLoading}><Download className="mr-2 h-4 w-4"/> Export History</Button>
                <div className="mt-4 max-h-[60vh] overflow-y-auto">
                    {historyLoading ? <div className="flex justify-center p-8"><LoaderCircle className="w-8 h-8 animate-spin"/></div> : <>
                        <HistorySection title="Sales" data={historyData?.sales} columns={['saleNo', 'createdAt', 'totalAmount']} formatCurrency={formatCurrency}/>
                        <HistorySection title="Invoices" data={historyData?.invoices} columns={['invoiceNo', 'createdAt', 'totalAmount', 'status']} formatCurrency={formatCurrency}/>
                        <HistorySection title="Quotations" data={historyData?.quotations} columns={['quotationNo', 'createdAt', 'totalAmount', 'status']} formatCurrency={formatCurrency}/>
                    </>}
                </div>
            </Modal>
        </>
    );
};

const HistorySection: React.FC<{title: string, data: any[] | undefined, columns: string[], formatCurrency: (v: number) => string}> = ({ title, data, columns, formatCurrency }) => {
    if (!data || data.length === 0) return null;
    return <div className="mb-6"><h3 className="text-xl font-semibold mb-2">{title}</h3><Table><TableHeader><TableRow>{columns.map(c => <TableHead key={c}>{c.replace(/_/g, ' ').replace('totalAmount', 'Amount').replace(/([A-Z])/g, ' $1').toUpperCase()}</TableHead>)}</TableRow></TableHeader><TableBody>
        {data.map(item => <TableRow key={item.id}>{columns.map(col => <TableCell key={col}>
            {col.includes('Amount') ? formatCurrency(item[col] || 0) : col.includes('At') || col.includes('Date') ? new Date(item[col]).toLocaleDateString() : item[col]}
        </TableCell>)}</TableRow>)}
    </TableBody></Table></div>
};

export default Customers;
