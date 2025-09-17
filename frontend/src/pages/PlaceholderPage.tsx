import React from 'react';
import { Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

interface PlaceholderPageProps {
    title: string;
    description?: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">{title}</h1>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Wrench className="mr-3 h-6 w-6 text-orange-500" />
                        Page Under Construction
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-400">{description || `The content for the "${title}" page is currently being developed and will be available soon.`}</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default PlaceholderPage;