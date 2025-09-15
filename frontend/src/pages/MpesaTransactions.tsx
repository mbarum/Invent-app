import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import Pagination from '../components/ui/Pagination.tsx';
import { LoaderCircle, AlertTriangle } from 'lucide-react';
import { MpesaTransaction, Branch } from '@masuma-ea/types';
import { getMpesaTransactions } from '../services/api.ts';
import toast from 'react-hot-toast';
import Select from '../components/ui/Select.tsx';

interface OutletContextType {
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

type MpesaStatus = 'Pending' | 'Completed' | 'Failed';

const getStatusBadge = (status: MpesaStatus) => {
    const baseClasses = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset";
    switch (status) {
        case 'Pending': return <span className={`${baseClasses} bg-yellow-400/10 text-yellow-400 ring-yellow-400/20`}>{status}</span>;
        case 'Completed': return <span className={`${baseClasses} bg-green-500/10 text-green-400 ring-green-500/20`}>{status}</span>;
        case 'Failed': return <span className={`${baseClasses} bg-red-400/10 text-red-400 ring-red-400/30`}>{status}</span>;
        default: return <span className={`${baseClasses} bg-gray-400/10 text-gray-400 ring-gray-400/20`}>{status}</span>;
    }
};

const MpesaTransactions: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [statusFilter, setStatusFilter] = useState('All');
    const itemsPerPage = 15;

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                setLoading(true);
                const { transactions: data, total } = await getMpesaTransactions(currentPage, itemsPerPage, statusFilter);
                setTransactions(data);
                setTotalItems(total);
            } catch (err) {
                setError("Failed to load M-Pesa transactions.");
                toast.error("Failed to load transactions.");
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, [currentPage, statusFilter]);

    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        const convertedAmount = amount * rate;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currentCurrency,
        }).format(convertedAmount);
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        }
        if (error) {
            return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        }
        if (transactions.length === 0) {
            return <div className="text-center p-8 text-gray-400">No M-Pesa transactions found for this filter.</div>;
        }

        return (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Receipt #</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Checkout ID</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((tx) => (
                            <TableRow key={tx.id}>
                                <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                                <TableCell className="font-semibold">{formatCurrency(tx.amount)}</TableCell>
                                <TableCell>{tx.phoneNumber}</TableCell>
                                <TableCell>{getStatusBadge(tx.status as MpesaStatus)}</TableCell>
                                <TableCell className="font-mono text-xs">{tx.mpesaReceiptNumber || 'N/A'}</TableCell>
                                <TableCell className="font-mono text-xs">{tx.saleNo || tx.invoiceNo || 'N/A'}</TableCell>
                                <TableCell className="font-mono text-xs">{tx.checkoutRequestId}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">M-Pesa Transactions</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>A log of all M-Pesa STK push transactions initiated through the POS.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-4 border-b border-gray-700">
                         <Select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full sm:w-52"
                            aria-label="Filter by status"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Pending">Pending</option>
                            <option value="Failed">Failed</option>
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
    );
};

export default MpesaTransactions;