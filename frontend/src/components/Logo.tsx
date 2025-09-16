import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <div className={`text-white text-2xl font-bold tracking-wider ${className}`}>
            MASUMA
        </div>
    );
};

export default Logo;
