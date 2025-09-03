import React from 'react';

const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <div className="text-center p-10 bg-gray-800 rounded-lg border border-gray-700">
        <h1 className="text-4xl font-bold text-orange-500">{title}</h1>
        <p className="text-gray-400 mt-2">This feature is under construction.</p>
        <p className="text-gray-500 mt-1">Please check back later!</p>
      </div>
    </div>
  );
};

export default PlaceholderPage;
