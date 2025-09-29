import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface ValidationMessageProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  className?: string;
  showIcon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const ValidationMessage: React.FC<ValidationMessageProps> = ({
  type,
  message,
  className = '',
  showIcon = true,
  dismissible = false,
  onDismiss
}) => {
  const config = {
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      iconColor: 'text-red-500'
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      iconColor: 'text-green-500'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      iconColor: 'text-yellow-500'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-500'
    }
  };

  const { icon: Icon, bgColor, borderColor, textColor, iconColor } = config[type];

  return (
    <div className={`flex items-start p-3 rounded-md border ${bgColor} ${borderColor} ${className}`} role={type === 'error' ? 'alert' : 'status'}>
      {showIcon && (
        <Icon size={16} className={`${iconColor} mr-2 mt-0.5 flex-shrink-0`} aria-hidden="true" />
      )}
      <span className={`text-sm ${textColor} flex-1`}>{message}</span>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className={`ml-2 ${textColor} hover:opacity-75 focus:outline-none`}
          aria-label="Dismiss message"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ValidationMessage;