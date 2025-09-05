import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Branch, Sale, Customer, ShippingLabel, ShippingStatus } from '@masuma-ea/types';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { DollarSign, ShoppingCart, Users, Truck, LoaderCircle, AlertTriangle } from 'lucide-react';
import { getSales, getCustomers, getShipments } from '../services/api';
import DateRangePicker from '../components/ui/DateRangePicker';

const getStatusBadge = (status: ShippingStatus) => {
  switch (status) {
    case ShippingStatus.DRAFT:
      return <span className="px-2 py-1 text-xs font-medium text-yellow-200 bg-yellow-900 rounded-full">{status}</span>;
    case ShippingStatus.PRINTED:
      return <span className="px-2 py-1 text-xs font-medium text-blue-200 bg-blue-900 rounded-full">{status}</span>;
    case ShippingStatus.SHIPPED:
      return <span className="px-2 py-1 text-xs font-medium text-green-200 bg-green-900 rounded-full">{status}</span>;
    default:
      return <span className="px-2 py-1 text-xs font-medium text-gray-200 bg-gray-700 rounded-full">{status}</span>;
  }
};

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const formatDate = (d: Date) => d.toISOString().split('T')[0];

const Reports: React.FC = () => {
  const { currentBranch, currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shipments, setShipments] = useState<ShippingLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    return { start: formatDate(startDate), end: formatDate(endDate) };
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // getCustomers doesn't need date range, it's a