import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { PlusCircle, Edit, LoaderCircle, AlertTriangle } from 'lucide-react';
// FIX: Changed import path for `types` to allow module resolution by removing the file extension.
import { User, UserRole } from '@masuma-ea/types';
import { getUsers, createUser, updateUser } from '../services/api';
import toast from 'react-hot-toast';

const getStatusBadge = (status: 'Active' | 'Inactive') => {
  const badgeClasses = status === 'Active'
    ? 'bg-green-500/10 text-green-400 ring-green-500/20'
    : 'bg-red-400/10 text-red-400 ring-red-400/30';

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${badgeClasses}`}>
      {status}
    </span>
  );
};

const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<Partial<User>>({});

    // Filtering and pagination state
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getUsers();
            setUsers(data);
            setError(null);
        } catch (err) {
            setError("Failed to load user data.");
            toast.error("Failed to load user data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, statusFilter]);

    const filteredUsers = useMemo(() => {
        return users
            .filter(user => {
                if (statusFilter !== 'All' && user.status !== statusFilter) return false;
                if (roleFilter !== 'All' && user.role !== roleFilter) return false;
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
                }
                return true;
            });
    }, [users, searchTerm, roleFilter, statusFilter]);

    const handleOpenModal = (user: User | null = null) => {
        setEditingUser(user);
        setFormData(user ? { ...user } : { name: '', email: '', password: '', role: UserRole.SALES_STAFF, status: 'Active' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({});
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                // Update user
                const updatedUser = await updateUser(editingUser.id, formData);
                setUsers(users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser} : u));
                toast.success('User updated successfully!');
            } else {
                // Create user
                const newUser = await createUser(formData);
                setUsers(prev => [newUser, ...prev]);
                toast.success('User created successfully!');
            }
            handleCloseModal();
        } catch (err: any) {
            toast.error(`Operation failed: ${err.message}`);
        }
    };
    
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        }
        if (error) {
            return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        }
        if (users.length > 0 && paginatedUsers.length === 0) {
            return <div className="text-center p-8 text-gray-400">No users found matching your criteria.</div>;
        }
        return (
            <>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{user.role}</TableCell>
                                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(user)}>
                                            <Edit className="h-4 w-4 mr-1" /> Edit
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredUsers.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                />
            </>
        );
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">User Management</h1>
                    <Button onClick={() => handleOpenModal()}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Create User
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Staff Accounts</CardTitle>
                        <CardDescription>Manage user accounts and their roles within the system.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 pb-4 border-b border-gray-700">
                           <Input
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="flex-grow"
                            />
                            <Select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value)}
                                className="w-full sm:w-56"
                            >
                                <option value="All">All Roles</option>
                                {Object.values(UserRole).map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </Select>
                            <Select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="w-full sm:w-48"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </Select>
                        </div>
                        {renderContent()}
                    </CardContent>
                </Card>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingUser ? 'Edit User' : 'Create New User'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Full Name" name="name" value={formData.name || ''} onChange={handleInputChange} required />
                    <Input label="Email" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} required />
                    {!editingUser && (
                         <Input label="Password" name="password" type="password" value={formData.password || ''} onChange={handleInputChange} required />
                    )}
                    {editingUser && (
                        <p className="text-xs text-gray-400">Password management is not available in this form. Please use a password reset feature.</p>
                    )}
                    <Select label="Role" name="role" value={formData.role || ''} onChange={handleInputChange} required>
                        {Object.values(UserRole).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </Select>
                    {editingUser && (
                        <Select label="Status" name="status" value={formData.status || 'Active'} onChange={handleInputChange} required>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </Select>
                    )}
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="secondary" type="button" onClick={handleCloseModal}>Cancel</Button>
                        <Button type="submit">Save User</Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default Users;