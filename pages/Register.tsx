
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { UploadCloud, LoaderCircle } from 'lucide-react';
import { registerUser } from '../services/api';
import toast from 'react-hot-toast';

const FileInput: React.FC<{ label: string; id: string; fileRef: React.RefObject<HTMLInputElement>; required?: boolean; onChange: (fileName: string) => void }> = ({ label, id, fileRef, required, onChange }) => {
    const [fileName, setFileName] = useState('Choose file...');
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
            <label htmlFor={id} className="flex h-10 w-full items-center rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-400 cursor-pointer hover:bg-gray-600">
                <UploadCloud className="mr-2 h-5 w-5 flex-shrink-0" />
                <span className="truncate">{fileName}</span>
            </label>
            <input 
                id={id} 
                type="file" 
                className="sr-only" 
                ref={fileRef} 
                required={required} 
                onChange={(e) => {
                    const name = e.target.files?.[0]?.name || 'Choose file...';
                    setFileName(name);
                    onChange(name);
                }}
            />
        </div>
    );
};


const Register: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState({ certOfInc: '', cr12: '' });

    const certOfIncRef = useRef<HTMLInputElement>(null);
    const cr12Ref = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            setIsLoading(false);
            return;
        }

        const certFile = certOfIncRef.current?.files?.[0];
        const cr12File = cr12Ref.current?.files?.[0];

        if (!certFile || !cr12File) {
            toast.error("Both document uploads are required.");
            setIsLoading(false);
            return;
        }

        try {
            await registerUser({
                businessName: formData.get('businessName') as string,
                kraPin: formData.get('kraPin') as string,
                contactName: formData.get('contactName') as string,
                contactEmail: formData.get('contactEmail') as string,
                contactPhone: formData.get('contactPhone') as string,
                password: password,
                certOfInc: certFile,
                cr12: cr12File,
            });
            toast.success('Registration submitted! Your application will be reviewed.');
            navigate('/login');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 py-12 px-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                     <h1 className="text-4xl font-bold text-white">
                        <span className="text-orange-500">Masuma</span> Wholesale
                    </h1>
                    <p className="text-gray-400 mt-2">Register for a business account to get wholesale prices</p>
                </div>
                <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
                    <CardHeader>
                        <CardTitle>Business Account Registration</CardTitle>
                        <CardDescription>Please provide your business details. All fields are required.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Business Name" name="businessName" id="businessName" placeholder="Your Company Ltd." required />
                                <Input label="KRA PIN" name="kraPin" id="kraPin" placeholder="A123456789B" required pattern="[A-Z][0-9]{9}[A-Z]" title="Please enter a valid KRA PIN (e.g., A123456789B)." />
                                <Input label="Contact Person Name" name="contactName" id="contactName" placeholder="John Doe" required />
                                <Input label="Contact Person Phone" name="contactPhone" id="contactPhone" type="tel" placeholder="+254 700 123 456" required />
                                <div className="md:col-span-2">
                                    <Input label="Contact Person Email" name="contactEmail" id="contactEmail" type="email" placeholder="john.doe@example.com" required />
                                </div>
                                <Input label="Password" name="password" id="password" type="password" required />
                                <Input label="Confirm Password" name="confirmPassword" id="confirmPassword" type="password" required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                               <FileInput label="Certificate of Incorporation" id="certOfInc" fileRef={certOfIncRef} required onChange={fileName => setFiles(f => ({...f, certOfInc: fileName}))} />
                               <FileInput label="CR12 Document" id="cr12" fileRef={cr12Ref} required onChange={fileName => setFiles(f => ({...f, cr12: fileName}))} />
                            </div>
                            <div className="pt-6">
                                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                                     {isLoading ? (
                                        <>
                                            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Application'
                                    )}
                                </Button>
                            </div>
                        </form>
                        <p className="mt-6 text-center text-sm text-gray-400">
                            Already have an account?{' '}
                            <Link to="/login" className="font-medium text-orange-500 hover:text-orange-400">
                                Sign In
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Register;