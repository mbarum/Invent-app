import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// FIX: Remove .tsx and .ts file extensions from imports for proper module resolution.
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Lock, LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { GOOGLE_CLIENT_ID } from '../config/permissions';
// FIX: Changed import to remove file extension for proper module resolution.
import Logo from '../components/Logo';

const GoogleLogo = () => (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.09-.4-4.58H24v8.69h11.85c-.52 2.8-2.07 5.2-4.41 6.84v5.62h7.22c4.22-3.88 6.65-9.69 6.65-16.57z"></path>
        <path fill="#34A853" d="M24 46c6.48 0 11.93-2.13 15.89-5.82l-7.22-5.62c-2.15 1.45-4.92 2.3-8.67 2.3-6.65 0-12.28-4.47-14.28-10.45H2.33v5.78C6.36 40.59 14.54 46 24 46z"></path>
        <path fill="#FBBC05" d="M9.72 28.21c-.4-1.18-.62-2.43-.62-3.71s.22-2.53.62-3.71V15H2.33C.86 17.93 0 20.84 0 24.29s.86 6.36 2.33 9.29l7.39-5.78z"></path>
        <path fill="#EA4335" d="M24 9.71c3.53 0 6.48 1.22 8.86 3.49l6.36-6.36C35.91 2.66 30.48 0 24 0 14.54 0 6.36 5.41 2.33 13.22l7.39 5.78c2-5.98 7.63-10.45 14.28-10.45z"></path>
    </svg>
);

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, loginWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = async (response: google.accounts.id.CredentialResponse) => {
        if (!response.credential) {
            toast.error("Google login failed. Please try again.");
            return;
        }
        setIsLoading(true);
        try {
            await loginWithGoogle(response.credential);
            toast.success('Logged in successfully!');
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            toast.error(`Login failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (window.google) {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleLogin,
                use_fedcm_for_prompt: true,
            });
            // You can also render a button:
            // google.accounts.id.renderButton(document.getElementById("googleSignInButton"), { theme: "outline", size: "large" });
            google.accounts.id.prompt(); // Show one-tap
        }
    }, [loginWithGoogle]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email, password);
            toast.success('Logged in successfully!');
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            toast.error(`Login failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
            <Card className="w-full max-w-md bg-gray-800/50 backdrop-blur-sm border-gray-700">
                <CardHeader className="text-center">
                    <div className="mx-auto w-40 mb-4">
                        <Logo />
                    </div>
                    <CardTitle>Welcome Back</CardTitle>
                    <CardDescription>Sign in to access the Masuma EA Hub</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Email Address"
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            required
                        />
                        <Input
                            label="Password"
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                            {isLoading ? <><LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Signing In...</> : <><Lock className="mr-2 h-5 w-5" /> Sign In</>}
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

                    <Button variant="secondary" className="w-full" size="lg" id="googleSignInButton" onClick={() => google.accounts.id.prompt()} disabled={isLoading}>
                        <GoogleLogo /> Sign in with Google
                    </Button>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-400">
                            Don't have a wholesale account?{' '}
                            <Link to="/register" className="font-medium text-orange-500 hover:text-orange-400">
                                Apply here
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;