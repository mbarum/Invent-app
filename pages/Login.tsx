import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Mail, Lock, LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        
        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            await onLogin(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };
    
    // Placeholder for Google Sign-In
    const handleGoogleSignIn = () => {
      toast.error("Google Sign-In is not implemented.");
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white">
                        <span className="text-orange-500">Masuma</span> EA Hub
                    </h1>
                    <p className="text-gray-400 mt-2">Admin & Wholesale Portal</p>
                </div>
                <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
                    <CardHeader className="text-center">
                        <CardTitle>Sign In</CardTitle>
                        <CardDescription>Enter your credentials to access your account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Input id="email" name="email" type="email" placeholder="Email" label="Email Address" required />
                            <Input id="password" name="password" type="password" placeholder="Password" label="Password" required />

                            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                                        Signing In...
                                    </>
                                ) : (
                                    <>
                                        <Lock className="mr-2 h-5 w-5" /> Sign In
                                    </>
                                )}
                            </Button>
                        </form>
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-gray-800 px-2 text-gray-400">Or continue with</span>
                            </div>
                        </div>
                        <Button variant="secondary" className="w-full" onClick={handleGoogleSignIn}>
                            Sign In with Google
                        </Button>
                        <p className="mt-6 text-center text-sm text-gray-400">
                            Need a wholesale account?{' '}
                            <Link to="/register" className="font-medium text-orange-500 hover:text-orange-400">
                                Register here
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Login;