import React from 'react';
import { AlertCircle, CheckCircle, Info, Eye, EyeOff } from 'lucide-react';

interface FormFieldProps {
  label: string;
  inputId?: string;
  required?: boolean;
  error?: string;
  success?: boolean;
  warning?: string;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
  showCharacterCount?: boolean;
  maxLength?: number;
  currentLength?: number;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  inputId,
  required = false,
  error,
  success = false,
  warning,
  helpText,
  children,
  className = '',
  showCharacterCount = false,
  maxLength,
  currentLength = 0
}) => {
  const getFieldStatus = () => {
    if (error) return 'error';
    if (warning) return 'warning';
    if (success) return 'success';
    return 'default';
  };

  const status = getFieldStatus();
  const resolvedInputId =
    inputId ??
    (React.isValidElement(children)
      ? (children.props as { id?: string }).id
      : undefined);

  const statusColors = {
    error: 'border-red-500 bg-red-50',
    warning: 'border-yellow-500 bg-yellow-50',
    success: 'border-green-500 bg-green-50',
    default: 'border-gray-300 focus-within:border-blue-500'
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700" htmlFor={resolvedInputId}>
          {label}
          {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
        {showCharacterCount && maxLength && (
          <span className={`text-xs ${
            currentLength > maxLength * 0.9 
              ? currentLength >= maxLength 
                ? 'text-red-600' 
                : 'text-yellow-600'
              : 'text-gray-600'
          }`}>
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
      
      <div className={`relative transition-all duration-200 rounded-md ${statusColors[status]}`}>
        {children}
        
        {/* Status indicators */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {status === 'success' && (
            <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
          )}
          {status === 'warning' && (
            <Info className="h-5 w-5 text-yellow-500" aria-hidden="true" />
          )}
        </div>
      </div>
      
      {/* Help text - shown when no error/warning */}
      {helpText && !error && !warning && (
        <p className="text-xs text-gray-600 flex items-start">
          <Info size={12} className="mr-1 mt-0.5 flex-shrink-0" />
          {helpText}
        </p>
      )}
      
      {/* Warning message */}
      {warning && !error && (
        <p className="text-sm text-yellow-700 flex items-start bg-yellow-50 p-2 rounded border border-yellow-200">
          <Info size={14} className="mr-2 mt-0.5 flex-shrink-0" />
          {warning}
        </p>
      )}
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-700 flex items-start bg-red-50 p-2 rounded border border-red-200" role="alert">
          <AlertCircle size={14} className="mr-2 mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;
