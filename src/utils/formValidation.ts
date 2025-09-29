// Enhanced form validation utilities

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Real-time validation with debouncing
export const createValidator = (rules: ValidationRule) => {
  return (value: string): ValidationResult => {
    // Required field validation
    if (rules.required && (!value || value.trim().length === 0)) {
      return { isValid: false, error: 'This field is required' };
    }
    
    // Skip other validations if field is empty and not required
    if (!value || value.trim().length === 0) {
      return { isValid: true };
    }
    
    // Length validations
    if (rules.minLength && value.length < rules.minLength) {
      return { 
        isValid: false, 
        error: `Must be at least ${rules.minLength} characters` 
      };
    }
    
    if (rules.maxLength && value.length > rules.maxLength) {
      return { 
        isValid: false, 
        error: `Must be no more than ${rules.maxLength} characters` 
      };
    }
    
    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      return { isValid: false, error: 'Invalid format' };
    }
    
    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        return { isValid: false, error: customError };
      }
    }
    
    return { isValid: true };
  };
};

// Predefined validators for common fields
export const validators = {
  name: createValidator({
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    custom: (value) => {
      if (value.trim().split(' ').length < 1) {
        return 'Please enter your full name';
      }
      return null;
    }
  }),
  
  email: createValidator({
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value) => {
      // Additional email validation
      if (value.includes('..')) return 'Invalid email format';
      if (value.startsWith('.') || value.endsWith('.')) return 'Invalid email format';
      return null;
    }
  }),
  
  phone: createValidator({
    required: false,
    custom: (value) => {
      if (!value) return null;
      const digits = value.replace(/\D/g, '');
      if (digits.length > 0 && digits.length < 10) {
        return 'Please enter a complete phone number';
      }
      if (digits.length > 11) {
        return 'Phone number is too long';
      }
      return null;
    }
  }),
  
  furnitureType: createValidator({
    required: true,
    custom: (value) => {
      const validTypes = ['Chair', 'Table', 'Bed', 'Dresser', 'Bookshelf', 'IKEA', 'Multiple', 'Other'];
      if (!validTypes.includes(value)) {
        return 'Please select a valid furniture type';
      }
      return null;
    }
  }),
  
  pieces: createValidator({
    required: true,
    custom: (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        return 'Please enter at least 1 piece';
      }
      if (num > 50) {
        return 'For large projects, please contact us directly';
      }
      return null;
    }
  })
};

// Form-level validation
export const validateForm = (formData: Record<string, string>): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  // Validate each field
  Object.entries(formData).forEach(([field, value]) => {
    if (validators[field as keyof typeof validators]) {
      const result = validators[field as keyof typeof validators](value);
      if (!result.isValid && result.error) {
        errors[field] = result.error;
      }
    }
  });
  
  return errors;
};

// Smart field suggestions
export const getFieldSuggestions = (field: string, value: string): string[] => {
  switch (field) {
    case 'furnitureType':
      const types = ['Chair', 'Table', 'Bed', 'Dresser', 'Bookshelf', 'IKEA', 'Multiple'];
      return types.filter(type => 
        type.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 3);
    
    case 'email':
      if (value.includes('@') && !value.includes('.')) {
        const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
        const username = value.split('@')[0];
        return commonDomains.map(domain => `${username}@${domain}`);
      }
      return [];
    
    default:
      return [];
  }
};

// Progressive validation - validate as user types
export const createProgressiveValidator = (rules: ValidationRule) => {
  let timeoutId: NodeJS.Timeout;
  
  return (value: string, callback: (result: ValidationResult) => void) => {
    clearTimeout(timeoutId);
    
    // Immediate validation for critical errors
    if (rules.required && !value.trim()) {
      callback({ isValid: false, error: 'This field is required' });
      return;
    }
    
    // Debounced validation for other rules
    timeoutId = setTimeout(() => {
      const validator = createValidator(rules);
      callback(validator(value));
    }, 300);
  };
};