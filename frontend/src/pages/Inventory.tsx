import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Pagination from '../components/ui/Pagination';
import { PlusCircle, Edit, LoaderCircle, AlertTriangle, Download } from 'lucide-react';
import { Product } from '@masuma-ea/types';
import { getProducts, createProduct, updateProduct } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/permissions';
import { useDataStore } from '../store/dataStore';

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


const Inventory: React.FC = () => {
    const { hasPermission } = useAuth();
    const canManageInventory = hasPermission(PERMISSIONS.MANAGE_INVENTORY);
    const { refetchProducts } = useDataStore();

    const [products, setProducts] = useState<Product[]>([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState<Partial<Product> & { oemNumbersStr?: string }>({});
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;
    
    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { products: data, total } = await getProducts({ page: currentPage, limit: itemsPerPage, searchTerm });
            setProducts(data);
            setTotalProducts(total);
        } catch (err) {
            setError("Failed to load inventory.");
            toast.error("Failed to load inventory.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [currentPage, searchTerm]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleOpenModal = (product: Product | null = null) => {
        setEditingProduct(product);
        setFormData(product ? { ...product, oemNumbersStr: (product.oemNumbers || []).join(', ') } : { partNumber: '', name: '', retailPrice: 0, wholesalePrice: 0, stock: 0, notes: '', oemNumbersStr: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
        setFormData({});
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...formData,
            retailPrice: Number(formData.retailPrice),
            wholesalePrice: Number(formData.wholesalePrice),
            stock: Number(formData.stock),
            oemNumbers: formData.oemNumbersStr?.split(',').map(s => s.trim()).filter(Boolean) || []
        };
        delete (payload as any).oemNumbersStr;

        try {
            if (editingProduct) {
                await updateProduct(editingProduct.id, payload);
                toast.success('Product updated successfully!');
            } else {
                await createProduct(payload);
                toast.success('Product created successfully!');
            }
            await fetchProducts(); // Refetch current page
            await refetchProducts(); // Refetch global store
            handleCloseModal();
        } catch (err: any) {
            toast.error(`Operation failed: ${err.message}`);
        }
    };
    
    const handleExport = async () => {
        try {
            const { products: allProducts } = await getProducts(); // Fetch all for export
            exportToCsv('inventory_export', ['Part Number', 'Name', 'Retail Price', 'Wholesale Price', 'Stock'], allProducts, ['partNumber', 'name', 'retailPrice', 'wholesalePrice', 'stock']);
        } catch (e) {
            toast.error("Failed to export inventory.");
        }
    };

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        if (totalProducts > 0 && products.length === 0) return <div className="text-center p-8 text-gray-400">No products found matching your criteria.</div>;

        return (
            <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Retail Price</TableHead>
                        <TableHead>Wholesale Price</TableHead>
                        <TableHead>Stock</TableHead>
                        {canManageInventory && <TableHead>Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.map((product) => (
                        <TableRow key={product.id}>
                            <TableCell className="font-mono">{product.partNumber}</TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>KES {Number(product.retailPrice).toLocaleString()}</TableCell>
                            <TableCell>KES {Number(product.wholesalePrice).toLocaleString()}</TableCell>
                            <TableCell>
                                {product.stock > 0 ? `${product.stock} units` : <span className="text-red-400">Out of Stock</span>}
                            </TableCell>
                            {canManageInventory && (
                                <TableCell>
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenModal(product)}>
                                        <Edit className="h-4 w-4 mr-1" /> Edit
                                    </Button>
                                </TableCell>
                            )}
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
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h1 className="text-3xl font-bold">Inventory</h1>
                     <div className="flex space-x-2">
                         <Button variant="secondary" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4"/> Export CSV
                        </Button>
                        {canManageInventory && (
                            <Button onClick={() => handleOpenModal()}>
                                <PlusCircle className="mr-2 h-5 w-5" /> Add Product
                            </Button>
                        )}
                    </div>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Product List</CardTitle>
                        <CardDescription>Browse and manage your product inventory.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                         <div className="p-4 border-b border-gray-700">
                             <Input 
                                placeholder="Search by part number or name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {renderContent()}
                         <div className="p-4 border-t border-gray-700">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(totalProducts / itemsPerPage)}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingProduct ? 'Edit Product' : 'Create New Product'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Part Number" name="partNumber" value={formData.partNumber || ''} onChange={handleInputChange} required />
                        <Input label="Product Name" name="name" value={formData.name || ''} onChange={handleInputChange} required />
                        <Input label="Retail Price (KES)" name="retailPrice" type="number" value={formData.retailPrice || ''} onChange={handleInputChange} required />
                        <Input label="Wholesale Price (KES)" name="wholesalePrice" type="number" value={formData.wholesalePrice || ''} onChange={handleInputChange} required />
                        <Input label="Stock Quantity" name="stock" type="number" value={formData.stock || ''} onChange={handleInputChange} required />
                         <Input label="OEM Numbers (comma-separated)" name="oemNumbersStr" value={formData.oemNumbersStr || ''} onChange={handleInputChange} />
                    </div>
                    <Textarea label="Notes" name="notes" value={formData.notes || ''} onChange={handleInputChange} />
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="secondary" type="button" onClick={handleCloseModal}>Cancel</Button>
                        <Button type="submit">Save Product</Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default Inventory;
