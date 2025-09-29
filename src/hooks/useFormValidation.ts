import { useState, useCallback, useEffect } from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string, allValues?: Record<string, string>) => string | null;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface FieldState {
  value: string;
  error: string;
  warning: string;
  touched: boolean;
  valid: boolean;
  validating: boolean;
}

export interface UseFormValidationOptions {
  initialValues: Record<string, string>;
  validationRules: Record<string, ValidationRule>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

export const useFormValidation = (options: UseFormValidationOptions) => {
  const {
    initialValues,
    validationRules,
    validateOnChange = false,
    validateOnBlur = true,
    debounceMs = 300
  } = options;

  // Initialize field states
  const [fields, setFields] = useState<Record<string, FieldState>>(() => {
    const initialFields: Record<string, FieldState> = {};
    Object.keys(initialValues).forEach(key => {
      initialFields[key] = {
        value: initialValues[key],
        error: '',
        warning: '',
        touched: false,
        valid: true,
        validating: false
      };
    });
    return initialFields;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Debounce validation
  const [validationTimeouts, setValidationTimeouts] = useState<Record<string, NodeJS.Timeout>>({});

  const validateField = useCallback((name: string, value: string, allValues?: Record<string, string>): { error: string; warning: string; valid: boolean } => {
    const rules = validationRules[name];
    if (!rules) return { error: '', warning: '', valid: true };

    // Required validation
    if (rules.required && (!value || value.trim().length === 0)) {
      return { error: 'This field is required', warning: '', valid: false };
    }

    // Skip other validations if field is empty and not required
    if (!value || value.trim().length === 0) {
      return { error: '', warning: '', valid: true };
    }

    // Length validations
    if (rules.minLength && value.length < rules.minLength) {
      return { 
        error: `Must be at least ${rules.minLength} characters`, 
        warning: '', 
        valid: false 
      };
    }

    if (rules.maxLength) {
      if (value.length > rules.maxLength) {
        return { 
          error: `Must be no more than ${rules.maxLength} characters`, 
          warning: '', 
          valid: false 
        };
      }
      // Warning when approaching limit
      if (value.length > rules.maxLength * 0.9) {
        return {
          error: '',
          warning: `Approaching character limit (${value.length}/${rules.maxLength})`,
          valid: true
        };
      }
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      return { error: 'Invalid format', warning: '', valid: false };
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value, allValues);
      if (customError) {
        return { error: customError, warning: '', valid: false };
      }
    }

    return { error: '', warning: '', valid: true };
  }, [validationRules]);

  const updateField = useCallback((name: string, updates: Partial<FieldState>) => {
    setFields(prev => ({
      ...prev,
      [name]: { ...prev[name], ...updates }
    }));
  }, []);

  const validateFieldWithDebounce = useCallback((name: string, value: string, immediate = false) => {
    const allValues = Object.keys(fields).reduce((acc, key) => {
      acc[key] = key === name ? value : fields[key].value;
      return acc;
    }, {} as Record<string, string>);

    if (immediate) {
      const validation = validateField(name, value, allValues);
      updateField(name, {
        error: validation.error,
        warning: validation.warning,
        valid: validation.valid,
        validating: false
      });
      return;
    }

    // Clear existing timeout
    if (validationTimeouts[name]) {
      clearTimeout(validationTimeouts[name]);
    }

    updateField(name, { validating: true });

    const timeoutId = setTimeout(() => {
      const validation = validateField(name, value, allValues);
      updateField(name, {
        error: validation.error,
        warning: validation.warning,
        valid: validation.valid,
        validating: false
      });
      
      setValidationTimeouts(prev => {
        const newTimeouts = { ...prev };
        delete newTimeouts[name];
        return newTimeouts;
      });
    }, debounceMs);

    setValidationTimeouts(prev => ({
      ...prev,
      [name]: timeoutId
    }));
  }, [fields, validateField, updateField, validationTimeouts, debounceMs]);

  const handleFieldChange = useCallback((name: string, value: string) => {
    updateField(name, { value });

    const rules = validationRules[name];
    const shouldValidate = validateOnChange || 
                          (rules?.validateOnChange) || 
                          (submitAttempted && fields[name]?.touched);

    if (shouldValidate) {
      validateFieldWithDebounce(name, value);
    }
  }, [validationRules, validateOnChange, submitAttempted, fields, updateField, validateFieldWithDebounce]);

  const handleFieldBlur = useCallback((name: string) => {
    updateField(name, { touched: true });

    const rules = validationRules[name];
    const shouldValidate = validateOnBlur || rules?.validateOnBlur !== false;

    if (shouldValidate) {
      validateFieldWithDebounce(name, fields[name].value, true);
    }
  }, [validationRules, validateOnBlur, fields, updateField, validateFieldWithDebounce]);

  const validateAllFields = useCallback(() => {
    const allValues = Object.keys(fields).reduce((acc, key) => {
      acc[key] = fields[key].value;
      return acc;
    }, {} as Record<string, string>);

    let isFormValid = true;
    const updatedFields = { ...fields };

    Object.keys(fields).forEach(name => {
      const validation = validateField(name, fields[name].value, allValues);
      updatedFields[name] = {
        ...updatedFields[name],
        error: validation.error,
        warning: validation.warning,
        valid: validation.valid,
        touched: true,
        validating: false
      };

      if (!validation.valid) {
        isFormValid = false;
      }
    });

    setFields(updatedFields);
    return isFormValid;
  }, [fields, validateField]);

  const handleSubmit = useCallback((onSubmit: (values: Record<string, string>) => Promise<void> | void) => {
    return async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      setSubmitAttempted(true);
      setIsSubmitting(true);

      // Clear any pending validations
      Object.values(validationTimeouts).forEach(clearTimeout);
      setValidationTimeouts({});

      const isValid = validateAllFields();

      if (isValid) {
        try {
          const values = Object.keys(fields).reduce((acc, key) => {
            acc[key] = fields[key].value;
            return acc;
          }, {} as Record<string, string>);

          await onSubmit(values);
        } catch (error) {
          console.error('Form submission error:', error);
        }
      }

      setIsSubmitting(false);
    };
  }, [fields, validationTimeouts, validateAllFields]);

  const reset = useCallback(() => {
    // Clear timeouts
    Object.values(validationTimeouts).forEach(clearTimeout);
    setValidationTimeouts({});

    // Reset fields
    const resetFields: Record<string, FieldState> = {};
    Object.keys(initialValues).forEach(key => {
      resetFields[key] = {
        value: initialValues[key],
        error: '',
        warning: '',
        touched: false,
        valid: true,
        validating: false
      };
    });
    setFields(resetFields);
    setSubmitAttempted(false);
    setIsSubmitting(false);
  }, [initialValues, validationTimeouts]);

  const getFieldProps = useCallback((name: string) => {
    const field = fields[name];
    return {
      value: field?.value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        handleFieldChange(name, e.target.value);
      },
      onBlur: () => handleFieldBlur(name),
      'aria-invalid': !field?.valid,
      'aria-describedby': field?.error ? `${name}-error` : undefined
    };
  }, [fields, handleFieldChange, handleFieldBlur]);

  const isFormValid = Object.values(fields).every(field => field.valid);
  const hasErrors = Object.values(fields).some(field => field.error);
  const isValidating = Object.values(fields).some(field => field.validating);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(validationTimeouts).forEach(clearTimeout);
    };
  }, [validationTimeouts]);

  return {
    fields,
    isFormValid,
    hasErrors,
    isValidating,
    isSubmitting,
    submitAttempted,
    handleFieldChange,
    handleFieldBlur,
    handleSubmit,
    reset,
    getFieldProps,
    validateField: (name: string) => validateFieldWithDebounce(name, fields[name].value, true)
  };
};