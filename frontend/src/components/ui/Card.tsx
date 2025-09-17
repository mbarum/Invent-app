import React from 'react';

// FIX: Update CardProps to accept standard HTML attributes to allow event handlers like onMouseDown.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

// FIX: Pass through props to the underlying div element.
const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-md ${className}`} {...props}>
            {children}
        </div>
    );
};

// FIX: Define specific props for CardHeader and pass them through. It previously reused CardProps incorrectly.
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}
const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '', ...props }) => {
    return <div className={`p-4 sm:p-6 border-b border-gray-700 ${className}`} {...props}>{children}</div>;
};

// FIX: Define specific props for CardContent and pass them through.
interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}
const CardContent: React.FC<CardContentProps> = ({ children, className = '', ...props }) => {
    return <div className={`p-4 sm:p-6 ${className}`} {...props}>{children}</div>;
};

// FIX: Define specific props for CardTitle, extending heading attributes, and pass them through.
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode;
    className?: string;
}
const CardTitle: React.FC<CardTitleProps> = ({ children, className = '', ...props }) => {
    return <h3 className={`text-lg font-semibold text-white ${className}`} {...props}>{children}</h3>;
};

// FIX: Define specific props for CardDescription, extending paragraph attributes, and pass them through.
interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode;
    className?: string;
}
const CardDescription: React.FC<CardDescriptionProps> = ({ children, className = '', ...props }) => {
    return <p className={`text-sm text-gray-400 ${className}`} {...props}>{children}</p>;
};

export { Card, CardHeader, CardContent, CardTitle, CardDescription };