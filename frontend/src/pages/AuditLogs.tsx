
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.tsx';
import Pagination from '../components/ui/Pagination.tsx';
import { LoaderCircle, AlertTriangle } from 'lucide-react';
import { AuditLog } from '@masuma-ea/types';
import { getAuditLogs } from '../services/api.ts';
import toast from 'react-hot-toast';

const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const itemsPerPage = 15;

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const { logs: data, total } = await getAuditLogs(currentPage, itemsPerPage);
                setLogs(data);
                setTotalLogs(total);
            } catch (err) {
                setError("Failed to load audit logs.");
                toast.error("Failed to load audit logs.");
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [currentPage]);

    const totalPages = Math.ceil(totalLogs / itemsPerPage);

    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        }
        if (error) {
            return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        }
        if (logs.length === 0) {
            return <div className="text-center p-8 text-gray-400">No audit logs found.</div>;
        }

        return (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                <TableCell>{log.userName || log.userId}</TableCell>
                                <TableCell><span className="font-mono bg-gray-700/50 px-2 py-1 rounded text-xs">{log.action}</span></TableCell>
                                <TableCell className="text-xs text-gray-400"><pre>{JSON.stringify(log.details, null, 2)}</pre></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Audit Logs</h1>
            <Card>
                <CardHeader>
                    <CardTitle>System Activity</CardTitle>
                    <CardDescription>A chronological record of actions performed within the system.</CardDescription>
                </CardHeader>
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
    );
};

export default AuditLogs;