import React from 'react';

interface LogoProps {
  className?: string;
  showHub?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = '', showHub = false }) => {
  const viewBoxWidth = showHub ? 270 : 200;
  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} 40`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-labelledby="logo-title"
    >
      <title id="logo-title">Masuma EA Hub Logo</title>
      <text
        x="0"
        y="30"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="32"
        fontWeight="bold"
        fill="#f97316" // Corresponds to text-orange-500
      >
        Masuma
      </text>
      <text
        x="128"
        y="30"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="32"
        fontWeight="bold"
        fill="#f3f4f6" // Corresponds to text-gray-100
      >
        EA
      </text>
      {showHub && (
        <text
          x="180"
          y="30"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontSize="32"
          fontWeight="bold"
          fill="#f3f4f6" // Corresponds to text-gray-100
        >
          Hub
        </text>
      )}
    </svg>
  );
};

export default Logo;
