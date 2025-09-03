

import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { LoaderCircle, AlertTriangle, ArrowUp, ArrowDown, PlusCircle } from 'lucide-react';
import { Customer, Sale } from '../types';
import { getCustomers, getSales, createCustomer } from '../services/api';
import toast from 'react-hot-toast';

// Enriched customer data type
interface CustomerSegmentData extends Customer {
    totalSpending: number;
    totalOrders: number;
    lastPurchaseDate: Date | null;
}

type NewCustomerData = Omit<Customer, 'id' | 'totalSpending' | 'totalOrders' | 'lastPurchaseDate'>;

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

const Customers: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const [customers, setCustomers] = useState<CustomerSegmentData[]>([]);
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
    const [newCustomer, setNewCustomer] = useState<NewCustomerData>({ name: '', phone: '', address: '', kraPin: ''});

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                const [customersData, salesData] = await Promise.all([getCustomers(), getSales()]);

                const salesByCustomerId = salesData.reduce<Record<number, Sale[]>>((acc, sale) => {
                    if (!acc[sale.customer_id]) acc[sale.customer_id] = [];
                    acc[sale.customer_id].push(sale);
                    return acc;
                }, {});

                const enrichedCustomers = customersData.map((customer): CustomerSegmentData => {
                    const customerSales = salesByCustomerId[customer.id] || [];
                    const totalSpending = customerSales.reduce((sum, s) => sum + (s.amount || 0), 0);
                    const totalOrders = customerSales.length;
                    const lastPurchaseDate = customerSales.length > 0
                        ? new Date(Math.max(...customerSales.map(s => new Date(s.created_at).getTime())))
                        : null;

                    return { ...customer, totalSpending, totalOrders, lastPurchaseDate };
                });

                setCustomers(enrichedCustomers);
            } catch (err) {
                setError("Failed to load customer data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        const convertedAmount = amount * rate;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currentCurrency,
        }).format(convertedAmount);
    };

    const filteredAndSortedCustomers = useMemo(() => {
        let filtered = [...customers];

        // Search filter
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(lowercasedTerm) ||
                c.phone.toLowerCase().includes(lowercasedTerm)
            );
        }

        // Spending filter
        filtered = filtered.filter(c => {
            switch (spendingFilter) {
                case 'high': return c.totalSpending >= 100000;
                case 'mid': return c.totalSpending >= 20000 && c.totalSpending < 100000;
                case 'low': return c.totalSpending > 0 && c.totalSpending < 20000;
                case 'none': return c.totalSpending === 0;
                default: return true;
            }
        });

        // Recency filter
        const now = new Date().getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const ninetyDays = 90 * 24 * 60 * 60 * 1000;
        filtered = filtered.filter(c => {
            if (!c.lastPurchaseDate) {
                return recencyFilter === 'all' || recencyFilter === 'inactive';
            }
            const diff = now - c.lastPurchaseDate.getTime();
            switch (recencyFilter) {
                case 'active': return diff <= thirtyDays;
                case 'at_risk': return diff > thirtyDays && diff <= ninetyDays;
                case 'inactive': return diff > ninetyDays;
                default: return true;
            }
        });

        // Sorting
        filtered.sort((a, b) => {
            let aValue: any = a[sortConfig.key];
            let bValue: any = b[sortConfig.key];
            
            if (sortConfig.key === 'lastPurchaseDate') {
                aValue = aValue ? aValue.getTime() : 0;
                bValue = bValue ? bValue.getTime() : 0;
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        return filtered;
    }, [customers, searchTerm, spendingFilter, recencyFilter, sortConfig]);

    const handleSort = (key: SortKey) => {
        let direction: SortDirection = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewCustomer(prev => ({ ...prev, [name]: value }));
    };
    
    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const addedCustomer = await createCustomer(newCustomer);
            const newCustomerWithStats: CustomerSegmentData = {
                ...addedCustomer,
                totalSpending: 0,
                totalOrders: 0,
                lastPurchaseDate: null,
            };
            setCustomers(prev => [newCustomerWithStats, ...prev]);
            setAddModalOpen(false);
            setNewCustomer({ name: '', phone: '', address: '', kraPin: ''});
            toast.success('Customer added successfully!');
        } catch (err: any) {
            toast.error(`Failed to add customer: ${err.message}`);
        }
    };

    const totalPages = Math.ceil(filteredAndSortedCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredAndSortedCustomers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, spendingFilter, recencyFilter]);

    const SortableHeader: React.FC<{ sortKey: SortKey; children: React.ReactNode; className?: string }> = ({ sortKey, children, className }) => (
        <TableHead className={`cursor-pointer hover:bg-gray-700 ${className}`} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center">
                {children}
                {sortConfig.key === sortKey && (
                    sortConfig.direction === 'ascending'
                        ? <ArrowUp className="ml-2 h-4 w-4" />
                        : <ArrowDown className="ml-2 h-4 w-4" />
                )}
            </div>
        </TableHead>
    );

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        if (customers.length > 0 && paginatedCustomers.length === 0) {
            return <div className="text-center p-8 text-gray-400">No customers found matching your criteria.</div>;
        }
        return (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableHeader sortKey="name">Customer Name</SortableHeader>
                            <TableHead>Contact</TableHead>
                            <SortableHeader sortKey="totalOrders" className="text-center">Total Orders</SortableHeader>
                            <SortableHeader sortKey="totalSpending" className="text-right">Total Spending ({currentCurrency})</SortableHeader>
                            <SortableHeader sortKey="lastPurchaseDate">Last Purchase</SortableHeader>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedCustomers.map((customer) => (
                            <TableRow key={customer.id}>
                                <TableCell className="font-medium">{customer.name}</TableCell>
                                <TableCell>
                                    <div>{customer.phone}</div>
                                    <div className="text-xs text-gray-400">{customer.address}</div>
                                </TableCell>
                                <TableCell className="text-center">{customer.totalOrders}</TableCell>
                                <TableCell className="font-semibold text-right">
                                    <div>{formatCurrency(customer.totalSpending)}</div>
                                    {currentCurrency !== 'KES' && <div className="text-xs text-gray-400 font-normal">KES {customer.totalSpending.toLocaleString()}</div>}
                                </TableCell>
                                <TableCell>
                                    {customer.lastPurchaseDate
                                        ? customer.lastPurchaseDate.toLocaleDateString()
                                        : 'N/A'}
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
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Customer Management</h1>
                    <Button onClick={() => setAddModalOpen(true)}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Add Customer
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Customer Segmentation</CardTitle>
                        <CardDescription>Filter and sort customers based on their activity.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                placeholder="Search by name or phone..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="md:col-span-1"
                            />
                            <Select label="Spending Tier" value={spendingFilter} onChange={e => setSpendingFilter(e.target.value)}>
                                <option value="all">All Spending Tiers</option>
                                <option value="high">High Spenders (&gt; KES 100k)</option>
                                <option value="mid">Mid Tier (KES 20k-100k)</option>
                                <option value="low">Low Tier (&lt; KES 20k)</option>
                                <option value="none">No Purchases</option>
                            </Select>
                            <Select label="Recency" value={recencyFilter} onChange={e => setRecencyFilter(e.target.value)}>
                                <option value="all">All Recency</option>
                                <option value="active">Active (Last 30 days)</option>
                                <option value="at_risk">At Risk (31-90 days)</option>
                                <option value="inactive">Inactive (&gt; 90 days)</option>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
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
            
            <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Add New Customer">
                <form onSubmit={handleAddCustomer} className="space-y-4">
                    <Input label="Full Name" name="name" value={newCustomer.name} onChange={handleInputChange} required />
                    <Input label="Phone Number" name="phone" type="tel" value={newCustomer.phone} onChange={handleInputChange} required />
                    <Input label="Address" name="address" value={newCustomer.address} onChange={handleInputChange} required />
                    <Input label="KRA PIN (Optional)" name="kraPin" value={newCustomer.kraPin || ''} onChange={handleInputChange} />
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="secondary" type="button" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Customer</Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default Customers;