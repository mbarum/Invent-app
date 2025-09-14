import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.tsx';
import Input from '../components/ui/Input.tsx';
import Button from '../components/ui/Button.tsx';
import { Lock, LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.tsx';
import { GOOGLE_CLIENT_ID } from '../config/permissions.ts';
import Logo from '../components/Logo.tsx';

const GoogleLogo = () => (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.09-.4-4.58H24v8.69h11.85c-.52 2.8-2.07 5.2-4.41 6.84v5.62h7.22c4.22-3.88 6.65-9.69 6.65-16.57z"></path>
        <path fill="#34A853" d="M24 46c6.48 0 11.93-2.13 15.89-5.82l-7.22-5.62c-2.15 1.45-4.92 2.3-8.67 2.3-6.65 0-12.28-4.47-14.28-10.45H2.33v5.78C6.36 40.59 14.54 46 24 46z"></path>
        <path fill="#FBBC05" d="M9.72 28.21c-.4-1.18-.62-2.43-.62-3.71s.22-2.53.62-3.71V15H2.33C.86 17.93 0 21.35 0 24.5s.86 6.57 2.33 9.5l7.39-5.79z"></path>
        <path fill="#EA4335" d="M24 9.4c3.48 0 6.6.1.2 9.28l7.58-7.58C35.93 4.15 30.48 2 24 2 14.54 2 6.36 7.41 2.33 15l7.39 5.79c2-5.98 7.63-10.45 14.28-10.45z"></path>
    </svg>
);

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, loginWithGoogle } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    useEffect(() => {
        const handleGoogleCredentialResponse = async (response: google.accounts.id.CredentialResponse) => {
            setIsGoogleLoading(true);
            try {
                if (response.credential) {
                    await loginWithGoogle(response.credential);
                    navigate('/dashboard');
                } else {
                    throw new Error("No credential received from Google.");
                }
            } catch (err: any) {
                toast.error(err.message || 'Google Sign-In failed. Please try again.');
            } finally {
                setIsGoogleLoading(false);
            }
        };

        // Initialize Google Identity Services
        if (window.google) {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredentialResponse,
                use_fedcm_for_prompt: false,
            });
        } else {
             console.error("Google Sign-In script not loaded.");
        }

    }, [loginWithGoogle, navigate]);


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        
        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGoogleSignIn = () => {
      if (window.google) {
         window.google.accounts.id.prompt();
      } else {
          toast.error("Google Sign-In is not available at the moment.");
      }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 py-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Logo showHub={true} className="w-auto h-12 mx-auto" />
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

                            <Button type="submit" className="w-full" size="lg" disabled={isLoading || isGoogleLoading}>
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
                        <Button variant="secondary" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading || isGoogleLoading}>
                           {isGoogleLoading ? (
                                <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                           ) : (
                                <GoogleLogo />
                           )}
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
