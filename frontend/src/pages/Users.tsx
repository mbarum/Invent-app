import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { PlusCircle, Edit, LoaderCircle, AlertTriangle } from 'lucide-react';
import { User, UserRole } from '@masuma-ea/types';
import { getUsers, createUser, updateUser } from '../services/api';
import toast from 'react-hot-toast';

const getStatusBadge = (status: 'Active' | 'Inactive') => {
  const baseClasses = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset";
  if (status === 'Active') {
    return <span className={`${baseClasses} bg-green-500/10 text-green-400 ring-green-500/20`}>Active</span>;
  }
  return <span className={`${baseClasses} bg-red-400/10 text-red-400 ring-red-400/30`}>Inactive</span>;
};

const staffRoles: string[] = (Object.values(UserRole) as string[]).filter(role => role !== UserRole.B2B_CLIENT);

const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<Partial<User & { password?: string }>>({});

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getUsers();
            setUsers(data);
        } catch (err) {
            setError("Failed to load users.");
            toast.error("Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleOpenModal = (user: User | null = null) => {
        setEditingUser(user);
        setFormData(user ? { ...user } : { name: '', email: '', role: UserRole.SALES_STAFF, status: 'Active' });
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
                await updateUser(editingUser.id, formData);
                toast.success('User updated successfully!');
            } else {
                if (!formData.password) {
                    toast.error("Password is required for new users.");
                    return;
                }
                await createUser(formData);
                toast.success('User created successfully!');
            }
            fetchUsers();
            handleCloseModal();
        } catch (err: any) {
            toast.error(`Operation failed: ${err.message}`);
        }
    };

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        if (users.length === 0) return <div className="text-center p-8 text-gray-400">No users found.</div>;

        return (
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
                    {users.map((user: User) => (
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
        );
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">User Management</h1>
                    <Button onClick={() => handleOpenModal()}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Add User
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Staff & B2B Accounts</CardTitle>
                        <CardDescription>View and manage all users with access to the system.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {renderContent()}
                    </CardContent>
                </Card>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingUser ? 'Edit User' : 'Create New User'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Full Name" name="name" value={formData.name || ''} onChange={handleInputChange} required />
                    <Input label="Email Address" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} required />
                    <Select label="Role" name="role" value={String(formData.role || '')} onChange={handleInputChange} required disabled={formData.role === UserRole.B2B_CLIENT}>
                        {staffRoles.map(role => <option key={role} value={role}>{role}</option>)}
                    </Select>
                    <Select label="Status" name="status" value={formData.status || ''} onChange={handleInputChange} required>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </Select>
                    {!editingUser && (
                        <Input label="Password" name="password" type="password" value={formData.password || ''} onChange={handleInputChange} required />
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