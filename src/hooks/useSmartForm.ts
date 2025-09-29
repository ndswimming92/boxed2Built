import { useState, useCallback, useEffect } from 'react';
import { validateForm, ValidationResult } from '../utils/formValidation';

interface FormField {
  value: string;
  error: string;
  touched: boolean;
  valid: boolean;
}

interface UseSmartFormOptions {
  initialValues: Record<string, string>;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export const useSmartForm = (options: UseSmartFormOptions) => {
  const {
    initialValues,
    onSubmit,
    validateOnChange = false,
    validateOnBlur = true
  } = options;

  // Initialize form state
  const [fields, setFields] = useState<Record<string, FormField>>(() => {
    const initialFields: Record<string, FormField> = {};
    Object.keys(initialValues).forEach(key => {
      initialFields[key] = {
        value: initialValues[key],
        error: '',
        touched: false,
        valid: true
      };
    });
    return initialFields;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Get current form values
  const values = useCallback(() => {
    const currentValues: Record<string, string> = {};
    Object.keys(fields).forEach(key => {
      currentValues[key] = fields[key].value;
    });
    return currentValues;
  }, [fields]);

  // Validate single field
  const validateField = useCallback((name: string, value: string): ValidationResult => {
    // This would use your validation rules
    return { isValid: true }; // Simplified for now
  }, []);

  // Update field value
  const setFieldValue = useCallback((name: string, value: string) => {
    setFields(prev => {
      const field = prev[name];
      let error = field.error;
      let valid = field.valid;

      // Validate on change if enabled
      if (validateOnChange && field.touched) {
        const validation = validateField(name, value);
        error = validation.error || '';
        valid = validation.isValid;
      }

      return {
        ...prev,
        [name]: {
          ...field,
          value,
          error,
          valid
        }
      };
    });
  }, [validateField, validateOnChange]);

  // Mark field as touched and validate
  const setFieldTouched = useCallback((name: string) => {
    setFields(prev => {
      const field = prev[name];
      let error = '';
      let valid = true;

      // Validate on blur if enabled
      if (validateOnBlur) {
        const validation = validateField(name, field.value);
        error = validation.error || '';
        valid = validation.isValid;
      }

      return {
        ...prev,
        [name]: {
          ...field,
          touched: true,
          error,
          valid
        }
      };
    });
  }, [validateField, validateOnBlur]);

  // Check if form is valid
  const isValid = useCallback(() => {
    return Object.values(fields).every(field => field.valid);
  }, [fields]);

  // Check if form has been modified
  const isDirty = useCallback(() => {
    return Object.keys(fields).some(key => 
      fields[key].value !== initialValues[key]
    );
  }, [fields, initialValues]);

  // Get form errors
  const errors = useCallback(() => {
    const formErrors: Record<string, string> = {};
    Object.keys(fields).forEach(key => {
      if (fields[key].error) {
        formErrors[key] = fields[key].error;
      }
    });
    return formErrors;
  }, [fields]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setSubmitCount(prev => prev + 1);
    setIsSubmitting(true);

    // Mark all fields as touched
    setFields(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const validation = validateField(key, updated[key].value);
        updated[key] = {
          ...updated[key],
          touched: true,
          error: validation.error || '',
          valid: validation.isValid
        };
      });
      return updated;
    });

    // Check if form is valid
    const currentValues = values();
    const formErrors = validateForm(currentValues);
    
    if (Object.keys(formErrors).length === 0) {
      try {
        await onSubmit(currentValues);
      } catch (error) {
        console.error('Form submission error:', error);
      }
    }

    setIsSubmitting(false);
  }, [values, validateField, onSubmit]);

  // Reset form
  const reset = useCallback(() => {
    setFields(() => {
      const resetFields: Record<string, FormField> = {};
      Object.keys(initialValues).forEach(key => {
        resetFields[key] = {
          value: initialValues[key],
          error: '',
          touched: false,
          valid: true
        };
      });
      return resetFields;
    });
    setSubmitCount(0);
  }, [initialValues]);

  // Auto-save functionality
  useEffect(() => {
    if (isDirty()) {
      const timeoutId = setTimeout(() => {
        // Auto-save logic here
        localStorage.setItem('form-draft', JSON.stringify(values()));
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [values, isDirty]);

  return {
    fields,
    values: values(),
    errors: errors(),
    isValid: isValid(),
    isDirty: isDirty(),
    isSubmitting,
    submitCount,
    setFieldValue,
    setFieldTouched,
    handleSubmit,
    reset
  };
};