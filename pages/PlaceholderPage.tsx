
import React from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Wrench } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="p-10">
          <Wrench className="mx-auto h-16 w-16 text-orange-500 mb-4" />
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="text-gray-400 mt-2">This feature is currently under construction.</p>
          <p className="text-gray-500 mt-1">Check back soon for updates!</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlaceholderPage;
