import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  name,
  value,
  onChange,
  onBlur,
  placeholder = "Enter your password",
  className = '',
  autoComplete = "current-password",
  required = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full pr-12 ${className}`}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        {...props}
      />
      <button
        type="button"
        onClick={togglePasswordVisibility}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff size={20} aria-hidden="true" />
        ) : (
          <Eye size={20} aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export default PasswordField;