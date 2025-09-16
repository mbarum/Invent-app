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
        <path fill="#FBBC05" d="M9.72 28.21c-.4-1.18-.62-2.43-.62-3.71s.22-2.53.62-3.71V15H2.33C.86 17.93 0
