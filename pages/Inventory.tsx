

import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Pagination from '../components/ui/Pagination';
import { Upload, Download, LoaderCircle, AlertTriangle, PlusCircle, Edit } from 'lucide-react';
import { Product } from '../types';
import { getProducts, createProduct, importProducts, updateProduct } from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/permissions';
import Select from '../components/ui/Select';

interface OutletContextType {
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

type ProductFormData = Omit<Product, 'id'>;

const Inventory: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const { hasPermission } = useAuth();
    const canManageInventory = hasPermission(PERMISSIONS.MANAGE_INVENTORY);

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // Modal states
    const [isProductModalOpen, setProductModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    
    // Form & import states
    const [productForm, setProductForm] = useState<ProductFormData>({ partNumber: '', name: '', retailPrice: 0, wholesalePrice: 0, stock: 0 });
    const [importFile, setImportFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ProductFormData[]>([]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
            setError(null);
        } catch (err) {
            setError("Failed to load inventory.");
            toast.error("Failed to load inventory.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        const convertedAmount = amount * rate;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currentCurrency,
        }).format(convertedAmount);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.name.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        const LOW_STOCK_THRESHOLD = 10;
        switch (stockFilter) {
            case 'in_stock': return product.stock > LOW_STOCK_THRESHOLD;
            case 'low_stock': return product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
            case 'out_of_stock': return product.stock <= 0;
            default: return true;
        }
    });

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, stockFilter]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProductForm(prev => ({ ...prev, [name]: value }));
    };

    const handleOpenModal = (product: Product | null) => {
        setEditingProduct(product);
        setProductForm(product ? { ...product } : { partNumber: '', name: '', retailPrice: 0, wholesalePrice: 0, stock: 0 });
        setProductModalOpen(true);
    };

    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                const updated = await updateProduct(editingProduct.id, productForm as Product);
                setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
                toast.success('Product updated!');
            } else {
                const addedProduct = await createProduct(productForm);
                setProducts(prev => [addedProduct, ...prev]);
                toast.success('Product added successfully!');
            }
            setProductModalOpen(false);
        } catch (err: any) {
            toast.error(`Operation failed: ${err.message}`);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImportFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                try {
                    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                    const headers = lines.shift()?.split(',').map(h => h.trim()) || [];
                    const data = lines.map(line => {
                        const values = line.split(',');
                        return headers.reduce((obj, header, index) => {
                            const value = values[index]?.trim() || '';
                            if (header === 'retailPrice' || header === 'wholesalePrice' || header === 'stock') {
                                obj[header] = Number(value);
                            } else {
                                obj[header] = value;
                            }
                            return obj;
                        }, {} as any);
                    });
                    setParsedData(data);
                } catch (parseError) {
                    toast.error("Failed to parse CSV file. Please check its format.");
                    setParsedData([]);
                }
            };
            reader.readAsText(file);
        }
    };
    
    const handleImport = async () => {
        if (parsedData.length === 0) {
            toast.error("No valid data to import.");
            return;
        }
        try {
            await importProducts(parsedData);
            toast.success(`${parsedData.length} products imported successfully!`);
            setImportModalOpen(false);
            setImportFile(null);
            setParsedData([]);
            fetchProducts(); // Refresh the list
        } catch (err: any) {
            toast.error(`Import failed: ${err.message}`);
        }
    };
    
    const handleExport = () => {
        const headers = ['partNumber', 'name', 'retailPrice', 'wholesalePrice', 'stock'];
        const csvContent = [
            headers.join(','),
            ...filteredProducts.map(p => headers.map(h => p[h as keyof Product]).join(','))
        ].join('\n');
    
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'inventory_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Inventory exported!");
    };
    
    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        }
        if (error) {
            return <div className="flex justify-center items-center p-8 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
        }
        if (products.length > 0 && paginatedProducts.length === 0) {
            return <div className="text-center p-8 text-gray-400">No products found matching your search.</div>;
        }
        return (
            <div className="overflow-x-auto">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-right">Retail Price ({currentCurrency})</TableHead>
                        <TableHead className="text-right">Wholesale Price ({currentCurrency})</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        {canManageInventory && <TableHead>Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedProducts.map((product) => (
                        <TableRow key={product.id}>
                            <TableCell className="font-mono">{product.partNumber}</TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell className="text-right font-medium">
                                <div>{formatCurrency(product.retailPrice)}</div>
                                {currentCurrency !== 'KES' && <div className="text-xs text-gray-400 font-normal">KES {product.retailPrice.toLocaleString()}</div>}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-orange-400">
                                <div>{formatCurrency(product.wholesalePrice)}</div>
                                {currentCurrency !== 'KES' && <div className="text-xs text-gray-400 font-normal">KES {product.wholesalePrice.toLocaleString()}</div>}
                            </TableCell>
                            <TableCell className="text-right">{product.stock}</TableCell>
                            {canManageInventory && <TableCell><Button variant="ghost" size="sm" onClick={() => handleOpenModal(product)}><Edit className="h-4 w-4" /></Button></TableCell>}
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
                <h1 className="text-3xl font-bold">Inventory Management</h1>
                {canManageInventory && (
                    <Button onClick={() => handleOpenModal(null)}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Add Product
                    </Button>
                )}
            </div>
            
            {canManageInventory && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Catalogue Actions</CardTitle>
                        <div className="flex space-x-2">
                            <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                                <Upload className="mr-2 h-4 w-4" /> Import from CSV
                            </Button>
                            <Button variant="secondary" onClick={handleExport}>
                                <Download className="mr-2 h-4 w-4" /> Export to CSV
                            </Button>
                        </div>
                    </CardHeader>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Product Catalogue</CardTitle>
                    <CardDescription>A list of all products in your inventory.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <Input 
                            placeholder="Search by part number or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-grow"
                        />
                        <Select
                            value={stockFilter}
                            onChange={e => setStockFilter(e.target.value)}
                            className="w-full sm:w-52"
                            aria-label="Filter by stock status"
                        >
                            <option value="All">All Stock Levels</option>
                            <option value="in_stock">In Stock</option>
                            <option value="low_stock">Low Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                        </Select>
                    </div>
                    {renderContent()}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </CardContent>
            </Card>
        </div>
        
        {/* Add/Edit Product Modal */}
        <Modal isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)} title={editingProduct ? 'Edit Product' : 'Add New Product'}>
            <form onSubmit={handleProductSubmit} className="space-y-4">
                <Input label="Part Number" name="partNumber" value={productForm.partNumber} onChange={handleInputChange} required />
                <Input label="Product Name" name="name" value={productForm.name} onChange={handleInputChange} required />
                <Input label="Retail Price (KES)" name="retailPrice" type="number" step="0.01" value={productForm.retailPrice} onChange={handleInputChange} required />
                <Input label="Wholesale Price (KES)" name="wholesalePrice" type="number" step="0.01" value={productForm.wholesalePrice} onChange={handleInputChange} required />
                <Input label="Stock" name="stock" type="number" value={productForm.stock} onChange={handleInputChange} required />
                <div className="flex justify-end space-x-2 pt-2">
                    <Button variant="secondary" type="button" onClick={() => setProductModalOpen(false)}>Cancel</Button>
                    <Button type="submit">Save Product</Button>
                </div>
            </form>
        </Modal>

        {/* Import CSV Modal */}
        <Modal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} title="Import Catalogue from CSV">
            <div className="space-y-4">
                <CardDescription>
                    Upload a CSV file with headers: <code>partNumber</code>, <code>name</code>, <code>retailPrice</code>, <code>wholesalePrice</code>, <code>stock</code>.
                    Existing products with matching part numbers will be updated.
                </CardDescription>
                <Input type="file" accept=".csv" onChange={handleFileChange} />
                {parsedData.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium mb-2">Data Preview ({parsedData.length} rows found)</h4>
                        <div className="max-h-48 overflow-y-auto border border-gray-600 rounded-md p-2 bg-gray-900/50">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-1">PartNumber</TableHead>
                                        <TableHead className="py-1">Name</TableHead>
                                        <TableHead className="py-1 text-right">Stock</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedData.slice(0, 5).map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="py-1 text-xs">{p.partNumber}</TableCell>
                                            <TableCell className="py-1 text-xs">{p.name}</TableCell>
                                            <TableCell className="py-1 text-xs text-right">{p.stock}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                <div className="flex justify-end space-x-2 pt-2">
                    <Button variant="secondary" onClick={() => setImportModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleImport} disabled={parsedData.length === 0}>Import Data</Button>
                </div>
            </div>
        </Modal>
        </>
    );
};

export default Inventory;