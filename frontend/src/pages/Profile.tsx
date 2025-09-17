import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { updateCurrentUserPassword } from '../services/api';
import toast from 'react-hot-toast';
import { LoaderCircle, Save } from 'lucide-react';

const Profile: React.FC = () => {
    const { user, logout } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("New password must be at least 6 characters long.");
            return;
        }
        
        setIsSaving(true);
        try {
            await updateCurrentUserPassword({ currentPassword, newPassword });
            toast.success("Password updated successfully! Please log in again.", { duration: 4000 });
            // Clear fields after successful update
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            
            // Log the user out after password change for security
            setTimeout(() => {
                logout();
            }, 1500);

        } catch (err: any) {
            toast.error(`Failed to update password: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold">User Profile</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Your personal account details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input label="Full Name" value={user?.name || ''} readOnly />
                    <Input label="Email Address" value={user?.email || ''} readOnly />
                    <Input label="Role" value={user?.role || ''} readOnly />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your password for security. You will be logged out after a successful change.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <Input 
                            label="Current Password" 
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required 
                        />
                        <Input 
                            label="New Password" 
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required 
                        />
                        <Input 
                            label="Confirm New Password" 
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required 
                        />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                Update Password
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Profile;