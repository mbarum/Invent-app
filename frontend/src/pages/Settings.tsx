import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Textarea from '../components/ui/Textarea';
// FIX: Removed .ts extension for proper module resolution.
import { updateSettings } from '../services/api';
import { AppSettings } from '@masuma-ea/types';
import toast from 'react-hot-toast';
import { LoaderCircle, Save } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import Select from '../components/ui/Select';

const Settings: React.FC = () => {
    const { appSettings, refetchSettings, isInitialDataLoaded } = useDataStore();
    const [settings, setSettings] = useState<Partial<AppSettings>>({});
    const [credentials, setCredentials] = useState({
        mpesaPasskey: '',
        mpesaConsumerKey: '',
        mpesaConsumerSecret: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isInitialDataLoaded) {
            setSettings(appSettings);
        }
    }, [appSettings, isInitialDataLoaded]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (Object.keys(credentials).includes(name)) {
            setCredentials(prev => ({ ...prev, [name]: value }));
        } else {
            setSettings(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            
            const payload: Partial<AppSettings> = {
                ...settings,
                taxRate: Number(settings.taxRate) || 0,
                invoiceDueDays: Number(settings.invoiceDueDays) || 0,
                lowStockThreshold: Number(settings.lowStockThreshold) || 0,
            };

            if (credentials.mpesaPasskey) payload.mpesaPasskey = credentials.mpesaPasskey;
            if (credentials.mpesaConsumerKey) payload.mpesaConsumerKey = credentials.mpesaConsumerKey;
            if (credentials.mpesaConsumerSecret) payload.mpesaConsumerSecret = credentials.mpesaConsumerSecret;

            await updateSettings(payload as AppSettings);
            toast.success("Settings saved successfully!");
            
            await refetchSettings();
            setCredentials({
                mpesaPasskey: '',
                mpesaConsumerKey: '',
                mpesaConsumerSecret: '',
            });

        } catch (err) {
            toast.error("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };
    
    if (!isInitialDataLoaded) {
        return <div className="flex justify-center items-center h-64"><LoaderCircle className="w-8 h-8 animate-spin text-orange-500" /></div>;
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
                <Card>
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
                        <CardTitle>Financial & Operational</CardTitle>
                        <CardDescription>Manage tax, payment terms, and alerts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input label="VAT / Tax Rate (%)" name="taxRate" type="number" value={settings.taxRate || ''} onChange={handleInputChange} placeholder="e.g., 16" />
                        <Input label="Invoice Due Days" name="invoiceDueDays" type="number" value={settings.invoiceDueDays || ''} onChange={handleInputChange} placeholder="e.g., 30" />
                        <Input label="Low Stock Threshold" name="lowStockThreshold" type="number" value={settings.lowStockThreshold || ''} onChange={handleInputChange} placeholder="e.g., 10" />
                    </CardContent>
                </Card>
                
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Payment Information</CardTitle>
                        <CardDescription>These details will appear on quotations and invoices.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <Textarea 
                         label="Payment Details"
                         name="paymentDetails"
                         value={settings.paymentDetails || ''}
                         onChange={handleInputChange}
                         placeholder="e.g., Bank: Equity Bank, Acc No: 123456789, Branch: Westlands, M-PESA Till: 987654"
                         rows={4}
                       />
                       <Textarea 
                         label="Payment & Company Terms"
                         name="paymentTerms"
                         value={settings.paymentTerms || ''}
                         onChange={handleInputChange}
                         placeholder="e.g., Payment due within 30 days of invoice date. All goods remain property of Masuma EA until paid in full."
                         rows={4}
                       />
                    </CardContent>
                </Card>


                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>M-Pesa C2B Integration</CardTitle>
                        <CardDescription>Enter your live Safaricom Daraja API credentials. Existing credentials are not shown for security.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Paybill / Till Number" name="mpesaPaybill" value={settings.mpesaPaybill || ''} onChange={handleInputChange} />
                        <Input label="Lipa Na M-Pesa Passkey" name="mpesaPasskey" type="password" value={credentials.mpesaPasskey} onChange={handleInputChange} placeholder={settings.mpesaPasskey ? 'Value is set. Enter a new one to change.' : ''} />
                        <Input label="Consumer Key" name="mpesaConsumerKey" type="password" value={credentials.mpesaConsumerKey} onChange={handleInputChange} placeholder={settings.mpesaConsumerKey ? 'Value is set. Enter a new one to change.' : ''} />
                        <Input label="Consumer Secret" name="mpesaConsumerSecret" type="password" value={credentials.mpesaConsumerSecret} onChange={handleInputChange} placeholder={settings.mpesaConsumerSecret ? 'Value is set. Enter a new one to change.' : ''} />
                        <Select label="M-Pesa Environment" name="mpesaEnvironment" value={settings.mpesaEnvironment || 'sandbox'} onChange={handleInputChange} className="md:col-span-2">
                            <option value="sandbox">Sandbox (Testing)</option>
                            <option value="live">Live (Production)</option>
                        </Select>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Settings;
