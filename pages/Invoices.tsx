import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { Printer, Eye, LoaderCircle, AlertTriangle, Download } from 'lucide-react';
// FIX: Changed import path for `types` to allow module resolution by removing the file extension.
import { Invoice, InvoiceStatus, Branch } from '@masuma-ea/types';
import { getInvoices, getInvoiceDetails } from '../services/api';
import toast from 'react-hot-toast';
import InvoicePrint from '../components/InvoicePrint';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

const getStatusBadge = (status: InvoiceStatus) => {
  let badgeClasses = '';
  switch (status) {
    case InvoiceStatus.UNPAID:
      badgeClasses = 'bg-yellow-400/10 text-yellow-400 ring-yellow-400/20';
      break;
    case InvoiceStatus.PAID:
      badgeClasses = 'bg-green-500/10 text-green-400 ring-green-500/20';
      break;
    case InvoiceStatus.VOID:
      badgeClasses = 'bg-red-400/10 text-red-400 ring-red-400/30';
      break;
    default:
      badgeClasses = 'bg-gray-400/10 text-gray-400 ring-gray-400/20';
      break;
  }
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${badgeClasses}`}>{status}</span>;
};


const Invoices: React.FC = () => {
    const { currentCurrency, exchangeRates } = useOutletContext<OutletContextType>();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<