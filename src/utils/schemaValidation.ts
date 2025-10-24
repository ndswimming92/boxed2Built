export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateLocalBusinessSchema = (schemaData: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schemaData['@context']) {
    errors.push('Missing @context property');
  }

  if (!schemaData['@type']) {
    errors.push('Missing @type property');
  }

  if (!schemaData.name) {
    errors.push('Missing required property: name');
  }

  if (!schemaData.address) {
    errors.push('Missing required property: address');
  } else {
    if (!schemaData.address.addressLocality) {
      errors.push('Missing address.addressLocality');
    }
    if (!schemaData.address.addressRegion) {
      errors.push('Missing address.addressRegion');
    }
    if (!schemaData.address.addressCountry) {
      errors.push('Missing address.addressCountry');
    }
  }

  if (!schemaData.telephone && !schemaData.contactPoint) {
    warnings.push('Missing telephone or contactPoint');
  }

  if (!schemaData.url) {
    warnings.push('Missing url property');
  }

  if (!schemaData.geo) {
    warnings.push('Missing geo coordinates - recommended for local businesses');
  }

  if (!schemaData.openingHoursSpecification && !schemaData.openingHours) {
    warnings.push('Missing opening hours information');
  }

  if (!schemaData.areaServed) {
    warnings.push('Missing areaServed - recommended for service businesses');
  }

  if (!schemaData.priceRange) {
    warnings.push('Missing priceRange - recommended for businesses');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validateFAQSchema = (schemaData: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schemaData['@context']) {
    errors.push('Missing @context property');
  }

  if (schemaData['@type'] !== 'FAQPage') {
    errors.push('Invalid @type - should be FAQPage');
  }

  if (!schemaData.mainEntity || !Array.isArray(schemaData.mainEntity)) {
    errors.push('Missing or invalid mainEntity array');
  } else {
    schemaData.mainEntity.forEach((question: any, index: number) => {
      if (question['@type'] !== 'Question') {
        errors.push(`Question ${index + 1}: Invalid @type - should be Question`);
      }
      if (!question.name) {
        errors.push(`Question ${index + 1}: Missing name property`);
      }
      if (!question.acceptedAnswer) {
        errors.push(`Question ${index + 1}: Missing acceptedAnswer property`);
      } else if (question.acceptedAnswer['@type'] !== 'Answer') {
        errors.push(`Question ${index + 1}: Invalid acceptedAnswer @type - should be Answer`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validateImageObjectSchema = (schemaData: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schemaData['@context']) {
    errors.push('Missing @context property');
  }

  if (!schemaData['@type']) {
    errors.push('Missing @type property');
  }

  if (!schemaData.image || !Array.isArray(schemaData.image)) {
    errors.push('Missing or invalid image array');
  } else {
    schemaData.image.forEach((img: any, index: number) => {
      if (img['@type'] !== 'ImageObject') {
        errors.push(`Image ${index + 1}: Invalid @type - should be ImageObject`);
      }
      if (!img.contentUrl && !img.url) {
        errors.push(`Image ${index + 1}: Missing contentUrl or url property`);
      }
      if (!img.caption && !img.description) {
        warnings.push(`Image ${index + 1}: Missing caption or description - recommended`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const logSchemaValidation = (
  schemaType: string,
  validation: ValidationResult
): void => {
  if (!validation.isValid) {
    console.error(`❌ ${schemaType} Schema Validation Failed:`);
    validation.errors.forEach(error => console.error(`  - ${error}`));
  } else {
    console.log(`✅ ${schemaType} Schema is valid`);
  }

  if (validation.warnings.length > 0) {
    console.warn(`⚠️ ${schemaType} Schema Warnings:`);
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
};

export const testStructuredData = (jsonLdString: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(jsonLdString);

    if (!parsed['@context'] || !parsed['@context'].includes('schema.org')) {
      errors.push('Invalid or missing @context - should include schema.org');
    }

    if (!parsed['@type']) {
      errors.push('Missing @type property');
    }

    if (parsed['@type'] === 'LocalBusiness') {
      return validateLocalBusinessSchema(parsed);
    } else if (parsed['@type'] === 'FAQPage') {
      return validateFAQSchema(parsed);
    } else if (parsed['@type'] === 'ImageGallery' || parsed['@type'] === 'ImageObject') {
      return validateImageObjectSchema(parsed);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`JSON parsing error: ${(error as Error).message}`);
    return {
      isValid: false,
      errors,
      warnings
    };
  }
};

export const generateRichResultsTestUrl = (pageUrl: string): string => {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(pageUrl)}`;
};

export const generateSchemaMarkupValidatorUrl = (pageUrl: string): string => {
  return `https://validator.schema.org/#url=${encodeURIComponent(pageUrl)}`;
};
