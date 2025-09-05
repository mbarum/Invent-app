import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Select from '../components/ui/Select';
import { Product, Customer, Branch, Invoice, InvoiceStatus, Sale } from '@masuma-ea/types';
import { createSale, getInvoices, getInvoiceDetails, initiateMpesaPayment, getMpesaPaymentStatus } from '../services/api';
import { User, Search, X, Plus, Minus, Percent, Printer, LoaderCircle, FileText, Ban, Download, Phone, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import ReceiptPrint from '../components/ReceiptPrint';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDataStore } from '../store/dataStore';

interface OutletContextType {
  currentBranch: Branch;
  currentCurrency: string;
  exchangeRates: { [key: string]: number };
}

interface CartItem {
    product: Product;
    quantity: number;
}

const POS: React.FC = () => {
    const { current