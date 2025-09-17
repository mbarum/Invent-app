import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Pagination from '../components/ui/Pagination';
import { Upload, Download, LoaderCircle, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Product, UserRole } from '@masuma-ea/types';
import { getProducts, createProduct, importProducts, updateProduct, deleteProduct } from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/permissions';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

interface OutletContextType {
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

interface ProductFormState {
    partNumber: string;
    oemNumbers: string; // Comma-separated string for the input field
    name: string;
    retailPrice: number | string;
    wholesalePrice: number | string;
    stock: number | string;
    notes: string;
}

const exportToCsv = (filename: string, headers: string[], data: Product[]) => {
    const headerRow = headers.join(',');
    const csvContent = [
        headerRow,
        ...data.map(p => {
            const rowData = {
                ...p,
                oemNumbers: `"${(p.oemNumbers || []).join(',')}"`
            };
            return headers.map(h => {
                const value = (rowData as any)[h];
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            }).join(',');
        })
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

// A simple CSV line parser that handles quoted fields
const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
};


const Inventory: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const { user, hasPermission } = useAuth();
    const canManageInventory = hasPermission(PERMISSIONS.MANAGE_INVENTORY);
    const isB2B = user?.role === UserRole.B2B_CLIENT;
    
    const [products, setProducts] = useState<Product[]>([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const [isProductModalOpen, setProductModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    
    const [productForm, setProductForm] = useState<ProductFormState>({ partNumber: '', oemNumbers: '', name: '', retailPrice: 0, wholesalePrice: 0, stock: 0, notes: '' });
    const [parsedData, setParsedData] = useState<Partial<Product>[]>([]);

    const fetchProductsData = async () => {
        setLoading(true);
        try {
            const data = await getProducts({ page: currentPage, limit: itemsPerPage, searchTerm, stockFilter }) as { products: Product[], total: number };
            setProducts(data.products);
            setTotalProducts(data.total);
        } catch (error) {
            toast.error("Failed to fetch products.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProductsData();
    }, [currentPage, searchTerm, stockFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, stockFilter]);

    const formatCurrency = (amount: number) => {
        const rate = exchangeRates[currentCurrency] || 1;
        const convertedAmount = amount * rate;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currentCurrency,
        }).format(convertedAmount);
    };

    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProductForm(prev => ({ ...prev, [name]: value }));
    };

    const handleOpenModal = (product: Product | null) => {
        setEditingProduct(product);
        setProductForm(
            product 
            ? { ...product, retailPrice: product.retailPrice, wholesalePrice: product.wholesalePrice, stock: product.stock, oemNumbers: (product.oemNumbers || []).join(', '), notes: product.notes || '' } 
            : { partNumber: '', oemNumbers: '', name: '', retailPrice: 0, wholesalePrice: 0, stock: 0, notes: '' }
        );
        setProductModalOpen(true);
    };

    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...productForm,
                retailPrice: Number(productForm.retailPrice),
                wholesalePrice: Number(productForm.wholesalePrice),
                stock: Number(productForm.stock),
                oemNumbers: productForm.oemNumbers.split(',').map(oem => oem.trim()).filter(oem => oem),
            };

            if (editingProduct) {
                await updateProduct(editingProduct.id, payload);
                toast.success('Product updated!');
            } else {
                await createProduct(payload as Omit<Product, 'id'>);
                toast.success('Product added successfully!');
            }
            fetchProductsData();
            setProductModalOpen(false);
        } catch (err: any) {
            toast.error(`Operation failed: ${err.message}`);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                try {
                    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                    const headerLine = lines.shift();
                    if (!headerLine) throw new Error("CSV is empty or has no header.");

                    const headers = headerLine.split(',').map(h => h.trim());
                    const requiredHeaders = ['partNumber', 'name', 'retailPrice', 'wholesalePrice', 'stock'];
                    
                    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                    if(missingHeaders.length > 0) {
                        toast.error(`Missing required columns: ${missingHeaders.join(', ')}`, { duration: 6000 });
                        return;
                    }

                    const data = lines.map(line => {
                        const values = parseCsvLine(line);
                        const productData: Partial<Product> = {};
                        headers.forEach((header, index) => {
                            const value = values[index] || '';
                            if (header === 'oemNumbers') {
                                (productData as any)[header] = value ? value.split(',').map(o => o.trim()) : [];
                            } else if (['retailPrice', 'wholesalePrice', 'stock'].includes(header)) {
                                (productData as any)[header] = Number(value) || 0;
                            } else {
                                (productData as any)[header] = value;
                            }
                        });
                        return productData;
                    });
                    setParsedData(data);
                } catch (parseError: any) {
                    toast.error(`CSV Parse Error: ${parseError.message}`);
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
            await importProducts(parsedData as Omit<Product, 'id'>[]);
            toast.success(`${parsedData.length} products imported successfully!`);
            fetchProductsData();
            setImportModalOpen(false);
            setParsedData([]);
        } catch (err: any) {
            toast.error(`Import failed: ${err.message}`);
        }
    };
    
    const handleExport = async () => {
        try {
            // Fetch all products for export
            const allProductsData = await getProducts() as Product[];
            const headers = ['partNumber', 'oemNumbers', 'name', 'retailPrice', 'wholesalePrice', 'stock', 'notes'];
            exportToCsv('inventory_export', headers, allProductsData);
            toast.success("Inventory exported!");
        } catch(e) {
            toast.error("Failed to export inventory data.")
        }
    };

    const handleOpenDeleteModal = (product: Product) => {
        setProductToDelete(product);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!productToDelete) return;
        try {
            await deleteProduct(productToDelete.id);
            toast.success('Product deleted successfully!');
            fetchProductsData();
            setDeleteModalOpen(false);
            setProductToDelete(null);
        } catch (err: any) {
            toast.error(`Deletion failed: ${err.message}`);
        }
    };
    
    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center p-8"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
        }
        if (totalProducts > 0 && products.length === 0) {
            return <div className="text-center p-8 text-gray-400">No products found matching your search.</div>;
        }
        return (
            <div className="overflow-x-auto">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Part Number</TableHead>
                        <TableHead>OEM Numbers</TableHead>
                        <TableHead>Product Name</TableHead>
                        {isB2B ? (
                            <TableHead className="text-right">Wholesale Price ({currentCurrency})</TableHead>
                        ) : (
                            <>
                                <TableHead className="text-right">Retail Price ({currentCurrency})</TableHead>
                                <TableHead className="text-right">Wholesale Price ({currentCurrency})</TableHead>
                            </>
                        )}
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead>Notes</TableHead>
                        {canManageInventory && <TableHead>Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.map((product) => (
                        <TableRow key={product.id}>
                            <TableCell className="font-mono">{product.partNumber}</TableCell>
                            <TableCell className="font-mono text-xs">{product.oemNumbers?.join(', ')}</TableCell>
                            <TableCell>{product.name}</TableCell>
                             {isB2B ? (
                                <TableCell className="text-right font-semibold text-orange-400">
                                    <div>{formatCurrency(product.wholesalePrice)}</div>
                                </TableCell>
                             ) : (
                                <>
                                <TableCell className="text-right font-medium">
                                    <div>{formatCurrency(product.retailPrice)}</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-orange-400">
                                    <div>{formatCurrency(product.wholesalePrice)}</div>
                                </TableCell>
                                </>
                             )}
                            <TableCell className="text-right">{product.stock}</TableCell>
                            <TableCell className="text-xs text-gray-400 max-w-xs truncate" title={product.notes}>
                                {product.notes}
                            </TableCell>
                            {canManageInventory && (
                                <TableCell>
                                    <div className="flex items-center space-x-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(product)} title="Edit Product"><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400" onClick={() => handleOpenDeleteModal(product)} title="Delete Product"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-3xl font-bold">Inventory Management</h1>
                {canManageInventory && (
                    <Button onClick={() => handleOpenModal(null)} className="w-full sm:w-auto flex-shrink-0">
                        <PlusCircle className="mr-2 h-5 w-5" /> Add Product
                    </Button>
                )}
            </div>
            
            {canManageInventory && (
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle>Catalogue Actions</CardTitle>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                                    <Upload className="mr-2 h-4 w-4" />
                                    <span className="hidden md:inline">Import from CSV</span>
                                    <span className="md:hidden">Import</span>
                                </Button>
                                <Button variant="secondary" onClick={handleExport}>
                                    <Download className="mr-2 h-4 w-4" />
                                    <span className="hidden md:inline">Export to CSV</span>
                                    <span className="md:hidden">Export</span>
                                </Button>
                            </div>
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
                            placeholder="Search by part, OEM, or name..."
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
                <Input label="OEM Numbers (comma-separated)" name="oemNumbers" value={productForm.oemNumbers} onChange={handleInputChange} />
                <Input label="Product Name" name="name" value={productForm.name} onChange={handleInputChange} required />
                <Input label="Retail Price (KES)" name="retailPrice" type="number" step="0.01" value={productForm.retailPrice} onChange={handleInputChange} required />
                <Input label="Wholesale Price (KES)" name="wholesalePrice" type="number" step="0.01" value={productForm.wholesalePrice} onChange={handleInputChange} required />
                <Input label="Stock" name="stock" type="number" value={productForm.stock} onChange={handleInputChange} required />
                <Textarea label="Notes" name="notes" value={productForm.notes} onChange={handleInputChange} placeholder="Internal notes about the product..."/>
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
                    Upload a CSV file with headers: <code>partNumber</code>, <code>oemNumbers</code>, <code>name</code>, <code>retailPrice</code>, <code>wholesalePrice</code>, <code>stock</code>, and optionally <code>notes</code>.
                    Existing products with matching part numbers will be updated. Fields with commas must be enclosed in double quotes.
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
                                        <TableHead className="py-1">Notes</TableHead>
                                        <TableHead className="py-1 text-right">Retail</TableHead>
                                        <TableHead className="py-1 text-right">Stock</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedData.slice(0, 5).map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="py-1 text-xs">{p.partNumber}</TableCell>
                                            <TableCell className="py-1 text-xs">{p.name}</TableCell>
                                            <TableCell className="py-1 text-xs truncate max-w-[100px]" title={p.notes}>{p.notes}</TableCell>
                                            <TableCell className="py-1 text-xs text-right">{p.retailPrice}</TableCell>
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
        
        {/* Delete Confirmation Modal */}
        <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirm Deletion">
            <p>Are you sure you want to delete the product: <strong>{productToDelete?.name}</strong> ({productToDelete?.partNumber})?</p>
            <p className="text-sm text-yellow-400 mt-2">This action cannot be undone. Products referenced in existing sales or invoices cannot be deleted.</p>
            <div className="flex justify-end space-x-2 pt-4">
                <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
                <Button className="bg-red-600 hover:bg-red-700 focus:ring-red-500" onClick={handleDeleteConfirm}>Delete Product</Button>
            </div>
        </Modal>
        </>
    );
};

export default Inventory;