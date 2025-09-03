
import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { updateCurrentUserPassword } from '../services/api';
import toast from 'react-hot-toast';
import { LoaderCircle, Lock } from 'lucide-react';

const Profile: React.FC = () => {
    const { user } = useAuth();
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
            toast.success("Password updated successfully!");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            toast.error(`Failed to update password: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return null; // Or a loading state
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">My Profile</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>User Information</CardTitle>
                        <CardDescription>Your personal and role details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-400">Full Name</label>
                            <p className="text-lg font-semibold">{user.name}</p>
                        </div>
                         <div>
                            <label className="text-sm font-medium text-gray-400">Email Address</label>
                            <p className="text-lg">{user.email}</p>
                        </div>
                         <div>
                            <label className="text-sm font-medium text-gray-400">Role</label>
                            <p className="text-lg">{user.role}</p>
                        </div>
                         <div>
                            <label className="text-sm font-medium text-gray-400">Status</label>
                            <p className="text-lg">{user.status}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>Update your password for security.</CardDescription>
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
                            <div className="flex justify-end pt-2">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? (
                                        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                                    ) : (
                                        <Lock className="mr-2 h-5 w-5" />
                                    )}
                                    Update Password
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Profile;
