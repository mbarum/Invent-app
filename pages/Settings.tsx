


import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { getSettings, updateSettings } from '../services/api';
// FIX: Changed import path for 'types' to allow module resolution by removing the file extension.
import { AppSettings } from '@masuma-ea/types';
import toast from 'react-hot-toast';
import { LoaderCircle, AlertTriangle, Save } from 'lucide-react';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<Partial<AppSettings>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const data = await getSettings();
                setSettings(data);
            } catch (err) {
                setError("Failed to load settings.");
                toast.error("Failed to load settings.");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const settingsToSave = {
                ...settings,
                taxRate: Number(settings.taxRate) || 0,
                invoiceDueDays: Number(settings.invoiceDueDays) || 0,
                lowStockThreshold: Number(settings.lowStockThreshold) || 0,
            };
            await updateSettings(settingsToSave as AppSettings);
            toast.success("Settings saved successfully!");
        } catch (err) {
            toast.error("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
    }

    if (error) {
        return <div className="flex justify-center items-center h-64 text-red-400"><AlertTriangle className="w-6 h-6 mr-2" /> {error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Settings</h1>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                    Save Changes
                </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Company Information</CardTitle>
                        <CardDescription>This information will appear on invoices and receipts.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Company Name" name="companyName" value={settings.companyName || ''} onChange={handleInputChange} />
                        <Input label="KRA PIN" name="companyKraPin" value={settings.companyKraPin || ''} onChange={handleInputChange} />
                        <Input label="Address" name="companyAddress" value={settings.companyAddress || ''} onChange={handleInputChange} className="md:col-span-2"/>
                        <Input label="Phone Number" name="companyPhone" value={settings.companyPhone || ''} onChange={handleInputChange} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Financial Settings</CardTitle>
                        <CardDescription>Manage tax rates and payment terms.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input label="VAT / Tax Rate (%)" name="taxRate" type="number" value={settings.taxRate || ''} onChange={handleInputChange} placeholder="e.g., 16" />
                        <Input label="Invoice Due Days" name="invoiceDueDays" type="number" value={settings.invoiceDueDays || ''} onChange={handleInputChange} placeholder="e.g., 30" />
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Operational Settings</CardTitle>
                        <CardDescription>Configure inventory and other operational alerts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input label="Low Stock Threshold" name="lowStockThreshold" type="number" value={settings.lowStockThreshold || ''} onChange={handleInputChange} placeholder="e.g., 10" />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>M-Pesa C2B Integration</CardTitle>
                        {/* FIX: Updated description to reflect live credentials. */}
                        <CardDescription>Enter your live Safaricom Daraja API credentials for STK Push payments.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Paybill / Till Number" name="mpesaPaybill" value={settings.mpesaPaybill || ''} onChange={handleInputChange} />
                        <Input label="Lipa Na M-Pesa Passkey" name="mpesaPasskey" type="password" value={settings.mpesaPasskey || ''} onChange={handleInputChange} />
                        <Input label="Consumer Key" name="mpesaConsumerKey" type="password" value={settings.mpesaConsumerKey || ''} onChange={handleInputChange} />
                        <Input label="Consumer Secret" name="mpesaConsumerSecret" type="password" value={settings.mpesaConsumerSecret || ''} onChange={handleInputChange} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Settings;
