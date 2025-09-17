import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { PlusCircle, Edit, LoaderCircle } from 'lucide-react';
import { Branch } from '@masuma-ea/types';
// FIX: Removed .ts extension for proper module resolution.
import { createBranch, updateBranch } from '../services/api';
import toast from 'react-hot-toast';
import { useDataStore } from '../store/dataStore';

const Branches: React.FC = () => {
    const { branches, isInitialDataLoaded, refetchBranches } = useDataStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [formData, setFormData] = useState<Omit<Branch, 'id'>>({ name: '', address: '', phone: '' });

    const handleOpenModal = (branch: Branch | null = null) => {
        setEditingBranch(branch);
        setFormData(branch ? { name: branch.name, address: branch.address, phone: branch.phone } : { name: '', address: '', phone: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBranch(null);
        setFormData({ name: '', address: '', phone: '' });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingBranch) {
                await updateBranch(editingBranch.id, formData);
                toast.success('Branch updated successfully!');
            } else {
                await createBranch(formData);
                toast.success('Branch created successfully!');
            }
            await refetchBranches();
            handleCloseModal();
        } catch (err: any) {
            toast.error(`Operation failed: ${err.message}`);
        }
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Branch Management</h1>
                    <Button onClick={() => handleOpenModal()}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Create Branch
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Company Branches</CardTitle>
                        <CardDescription>View and manage all operational locations.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!isInitialDataLoaded ? (
                            <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Address</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {branches.map((branch) => (
                                        <TableRow key={branch.id}>
                                            <TableCell className="font-medium">{branch.name}</TableCell>
                                            <TableCell>{branch.address}</TableCell>
                                            <TableCell>{branch.phone}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenModal(branch)}>
                                                    <Edit className="h-4 w-4 mr-1" /> Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingBranch ? 'Edit Branch' : 'Create New Branch'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Branch Name" name="name" value={formData.name} onChange={handleInputChange} required />
                    <Input label="Address" name="address" value={formData.address} onChange={handleInputChange} required />
                    <Input label="Phone Number" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="secondary" type="button" onClick={handleCloseModal}>Cancel</Button>
                        <Button type="submit">Save Branch</Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default Branches;
