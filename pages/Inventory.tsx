import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Pagination from '../components/ui/Pagination';
import { Upload, Download, LoaderCircle, AlertTriangle } from 'lucide-react';
import { Product } from '../types';
import { getProducts } from '../services/api';

interface OutletContextType {
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const Inventory: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                const data = await getProducts();
                setProducts(data);
                setError(null);
            } catch (err) {
                setError("Failed to load inventory.");
            } finally {
                setLoading(false);
            }
        };
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

    const filteredProducts = products.filter(product =>
        product.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);


    const handleImport = () => alert("This would open a file dialog to import an Excel/CSV file.");
    const handleExport = (format: 'Excel' | 'PDF') => alert(`This would generate and download a ${format} file of the current catalogue.`);
    
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
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Inventory Management</h1>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Catalogue Actions</CardTitle>
                    <div className="flex space-x-2">
                        <Button variant="secondary" onClick={handleImport}>
                            <Upload className="mr-2 h-4 w-4" /> Import Catalogue
                        </Button>
                        <Button variant="secondary" onClick={() => handleExport('Excel')}>
                            <Download className="mr-2 h-4 w-4" /> Export to Excel
                        </Button>
                        <Button variant="secondary" onClick={() => handleExport('PDF')}>
                            <Download className="mr-2 h-4 w-4" /> Export to PDF
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Product Catalogue</CardTitle>
                    <CardDescription>A list of all products in your inventory.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="mb-4">
                        <Input 
                            placeholder="Search by part number or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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
    );
};

export default Inventory;
