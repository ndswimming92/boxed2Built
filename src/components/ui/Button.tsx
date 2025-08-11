import React from 'react';
import { trackEvent } from '../../utils/analytics';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'white';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  trackingLabel?: string;
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  type = 'button',
  disabled = false,
  trackingLabel,
  loading = false,
}) => {
  const baseClasses = 'rounded-lg font-medium transition-all duration-200 inline-flex items-center justify-center';
  
  const variantClasses = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 shadow-md hover:shadow-lg disabled:bg-gray-500 disabled:text-gray-200 disabled:cursor-not-allowed',
    secondary: 'bg-green-700 text-white hover:bg-green-800 shadow-md hover:shadow-lg disabled:bg-gray-500 disabled:text-gray-200 disabled:cursor-not-allowed',
    outline: 'bg-transparent border-2 border-blue-700 text-blue-700 hover:bg-blue-50 disabled:border-gray-500 disabled:text-gray-500 disabled:cursor-not-allowed',
    white: 'bg-white text-blue-700 hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-300 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed',
  };
  
  const sizeClasses = {
    sm: 'text-sm py-2 px-3',
    md: 'text-base py-2.5 px-5',
    lg: 'text-lg py-3 px-6',
  };

  const handleClick = () => {
    if (trackingLabel) {
      trackEvent(`button-click-${trackingLabel}`);
    }
    if (onClick) {
      onClick();
    }
  };
  
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${
        loading ? 'cursor-wait' : ''
      }`}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" className="mr-2" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;