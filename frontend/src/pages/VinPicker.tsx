import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Search, LoaderCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import toast from 'react-hot-toast';
import { getPartsByVin } from '../services/api';
import { VinSearchResult } from '@masuma-ea/types';

const VinPicker: React.FC = () => {
    const [vin, setVin] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<VinSearchResult[] | null>(null);

    const handleSearch = async () => {
        if (!vin.trim() || vin.length < 17) return;
        setIsSearching(true);
        setSearchResults(null);
        try {
            const results = await getPartsByVin(vin);
            setSearchResults(results);
        } catch (error) {
            toast.error("Failed to search for parts for this VIN.");
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">VIN Picker</h1>

            {/* VIN Search Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Search by VIN</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Input
                            placeholder="Enter 17-digit Vehicle Identification Number"
                            className="flex-grow"
                            value={vin}
                            onChange={(e) => setVin(e.target.value.toUpperCase())}
                            maxLength={17}
                        />
                        <Button onClick={handleSearch} disabled={isSearching || vin.length < 17}>
                            {isSearching ? (
                                <>
                                    <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <Search className="mr-2 h-5 w-5" />
                                    Search VIN
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Search Results Section */}
            {(isSearching || searchResults) && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Search Results for "{vin}"</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isSearching && <p className="text-gray-400">Searching for compatible parts...</p>}
                        {searchResults && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Part Number</TableHead>
                                        <TableHead>Part Name</TableHead>
                                        <TableHead>Compatibility</TableHead>
                                        <TableHead>Stock Level</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {searchResults.map(part => (
                                        <TableRow key={part.partNumber}>
                                            <TableCell className="font-mono">{part.partNumber}</TableCell>
                                            <TableCell>{part.name}</TableCell>
                                            <TableCell>{part.compatibility}</TableCell>
                                            <TableCell>{part.stock > 0 ? `${part.stock} units` : 'Out of Stock'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                         {!isSearching && searchResults && searchResults.length === 0 && (
                             <p className="text-gray-400">No compatible parts found for this VIN.</p>
                         )}
                    </CardContent>
                </Card>
            )}

            {/* Embedded Tool */}
            <div className="flex flex-col h-[70vh]">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold">Masuma.ru Official Picker</h2>
                    <p className="text-sm text-gray-400">For advanced lookup</p>
                </div>
                <div className="flex-1 rounded-lg overflow-hidden border border-gray-700">
                    <iframe
                        src="https://masuma.ru/#vin-picker"
                        title="Masuma VIN Picker"
                        className="w-full h-full"
                        style={{ border: 0 }}
                    />
                </div>
            </div>
        </div>
    );
};

export default VinPicker;
