
import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-md ${className}`}>
            {children}
        </div>
    );
};

const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => {
    return <div className={`p-4 sm:p-6 border-b border-gray-700 ${className}`}>{children}</div>;
};

const CardContent: React.FC<CardProps> = ({ children, className = '' }) => {
    return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
};

const CardTitle: React.FC<CardProps> = ({ children, className = '' }) => {
    return <h3 className={`text-lg font-semibold text-white ${className}`}>{children}</h3>;
};

const CardDescription: React.FC<CardProps> = ({ children, className = '' }) => {
    return <p className={`text-sm text-gray-400 ${className}`}>{children}</p>;
};

export { Card, CardHeader, CardContent, CardTitle, CardDescription };
