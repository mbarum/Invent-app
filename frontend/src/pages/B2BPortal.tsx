import React from 'react';

const B2BPortal: React.FC = () => {
    // This will be expanded with stock request features.
    // For now, it's a placeholder dashboard for the B2B client.

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">B2B Portal</h1>
             <div className="flex flex-col h-full items-center justify-center py-12">
                <div className="text-center p-10 bg-gray-800 rounded-lg border border-gray-700">
                    <h1 className="text-4xl font-bold text-orange-500">Welcome, Wholesale Partner!</h1>
                    <p className="text-gray-400 mt-2">This is your dedicated portal for managing stock requests.</p>
                    <p className="text-gray-500 mt-1">Navigate to the 'Wholesale Catalogue' to start creating a new stock request.</p>
                </div>
            </div>
        </div>
    );
};

export default B2BPortal;
