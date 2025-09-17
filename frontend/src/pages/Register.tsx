import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import { registerUser } from '../services/api';
import { LoaderCircle } from 'lucide-react';
import Logo from '../components/Logo';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState<{ certOfInc?: File; cr12?: File }>({});

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files } = e.target;
        if (files && files.length > 0) {
            setFiles(prev => ({ ...prev, [name]: files[0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        if (data.password !== data.confirmPassword) {
            toast.error("Passwords do not match.");
            setIsLoading(false);
            return;
        }

        if (!files.certOfInc || !files.cr12) {
            toast.error("Please upload both required documents.");
            setIsLoading(false);
            return;
        }

        try {
            await registerUser({
                businessName: data.businessName as string,
                kraPin: data.kraPin as string,
                contactName: data.contactName as string,
                contactEmail: data.contactEmail as string,
                contactPhone: data.contactPhone as string,
                password: data.password as string,
                certOfInc: files.certOfInc,
                cr12: files.cr12,
            });
            toast.success("Registration successful! Your application is under review.", { duration: 5000 });
            navigate('/login');
        } catch (err: any) {
            toast.error(`Registration failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 py-8">
            <Card className="w-full max-w-2xl bg-gray-800/50 backdrop-blur-sm border-gray-700">
                <CardHeader className="text-center">
                    <div className="mx-auto w-40 mb-4">
                        <Logo />
                    </div>
                    <CardTitle>Wholesale Account Registration</CardTitle>
                    <CardDescription>Complete the form to apply for a B2B account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md border-gray-600">
                            <legend className="text-lg font-semibold px-2 text-gray-200">Business Details</legend>
                            <Input label="Business/Company Name" name="businessName" required className="md:col-span-2" />
                            <Input label="KRA PIN" name="kraPin" required />
                        </fieldset>

                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md border-gray-600">
                            <legend className="text-lg font-semibold px-2 text-gray-200">Contact Person</legend>
                            <Input label="Full Name" name="contactName" required />
                            <Input label="Email Address" name="contactEmail" type="email" required />
                            <Input label="Phone Number" name="contactPhone" type="tel" required />
                        </fieldset>

                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md border-gray-600">
                            <legend className="text-lg font-semibold px-2 text-gray-200">Account Credentials</legend>
                            <Input label="Password" name="password" type="password" required />
                            <Input label="Confirm Password" name="confirmPassword" type="password" required />
                        </fieldset>

                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md border-gray-600">
                            <legend className="text-lg font-semibold px-2 text-gray-200">Required Documents</legend>
                            <Input label="Certificate of Incorporation (PDF)" name="certOfInc" type="file" accept=".pdf" onChange={handleFileChange} required />
                            <Input label="CR12 Document (PDF)" name="cr12" type="file" accept=".pdf" onChange={handleFileChange} required />
                        </fieldset>

                        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                            {isLoading ? <><LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Submitting Application...</> : 'Register'}
                        </Button>
                    </form>
                    <div className="mt-6 text-center">
                        <Link to="/login" className="font-medium text-orange-500 hover:text-orange-400">
                            &larr; Back to Login
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
export default Register;