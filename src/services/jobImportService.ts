import { Job, ServiceArea, PaymentMethod } from '../lib/supabase';
import { REFERRAL_SOURCES } from '../utils/jobCalculations';
import { JobCSVRow } from './jobExportService';

export interface ValidationError {
  row: number;
  field: keyof JobCSVRow;
  message: string;
  currentValue: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validRows: Partial<Job>[];
  totalRows: number;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  error?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;

  const cleaned = dateStr.trim();

  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ];

  for (const format of formats) {
    const match = cleaned.match(format);
    if (match) {
      let year: number, month: number, day: number;

      if (format === formats[1]) {
        [, year, month, day] = match.map(Number);
      } else {
        const parts = match.slice(1).map(Number);
        if (format === formats[0]) {
          [month, day, year] = parts;
        } else {
          [day, month, year] = parts;
        }
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) continue;

      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) continue;

      const isoYear = date.getFullYear();
      const isoMonth = String(date.getMonth() + 1).padStart(2, '0');
      const isoDay = String(date.getDate()).padStart(2, '0');
      return `${isoYear}-${isoMonth}-${isoDay}`;
    }
  }

  return null;
}

function parseNumber(numStr: string): number | null {
  if (!numStr || !numStr.trim()) return null;

  const cleaned = numStr.trim().replace(/[$,]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) return null;
  return num;
}

function parseBoolean(boolStr: string): boolean {
  if (!boolStr || !boolStr.trim()) return false;

  const cleaned = boolStr.trim().toLowerCase();
  return ['yes', 'true', '1', 'y', 't', '✓', 'x'].includes(cleaned);
}

function validateRequiredField(value: string, row: number, field: keyof JobCSVRow, errors: ValidationError[]): boolean {
  if (!value || !value.trim()) {
    errors.push({
      row,
      field,
      message: 'This field is required',
      currentValue: value,
    });
    return false;
  }
  return true;
}

function validateDate(dateStr: string, row: number, field: keyof JobCSVRow, errors: ValidationError[], required: boolean = false): string | null {
  if (!dateStr || !dateStr.trim()) {
    if (required) {
      errors.push({
        row,
        field,
        message: 'Date is required',
        currentValue: dateStr,
      });
    }
    return null;
  }

  const parsed = parseDate(dateStr);
  if (parsed === null) {
    errors.push({
      row,
      field,
      message: 'Invalid date format. Use MM/DD/YYYY or YYYY-MM-DD',
      currentValue: dateStr,
    });
  }

  return parsed;
}

function validateNumber(numStr: string, row: number, field: keyof JobCSVRow, errors: ValidationError[], required: boolean = false): number | null {
  if (!numStr || !numStr.trim()) {
    if (required) {
      errors.push({
        row,
        field,
        message: 'Number is required',
        currentValue: numStr,
      });
    }
    return null;
  }

  const parsed = parseNumber(numStr);
  if (parsed === null) {
    errors.push({
      row,
      field,
      message: 'Invalid number format',
      currentValue: numStr,
    });
  }

  return parsed;
}

function validateReferralSource(source: string, _row: number, _errors: ValidationError[]): string | null {
  if (!source || !source.trim()) return null;

  const cleaned = source.trim();
  const found = REFERRAL_SOURCES.find(s => s.toLowerCase() === cleaned.toLowerCase());

  if (found) {
    return found;
  }

  return cleaned;
}

function validateCity(city: string, _row: number, serviceAreas: ServiceArea[], _errors: ValidationError[]): string | null {
  if (!city || !city.trim()) return null;

  const cleaned = city.trim();
  const found = serviceAreas.find(area => area.city_name.toLowerCase() === cleaned.toLowerCase());

  if (found) {
    return found.city_name;
  }

  return cleaned;
}

function validatePaymentMethod(method: string, _row: number, paymentMethods: PaymentMethod[], _errors: ValidationError[]): string | null {
  if (!method || !method.trim()) return null;

  const cleaned = method.trim();
  const found = paymentMethods.find(pm => pm.method_name.toLowerCase() === cleaned.toLowerCase());

  if (found) {
    return found.method_name;
  }

  return cleaned;
}

export async function validateCSVData(
  csvContent: string,
  serviceAreas: ServiceArea[],
  paymentMethods: PaymentMethod[]
): Promise<ValidationResult> {
  const rows = parseCSV(csvContent);
  const errors: ValidationError[] = [];
  const validRows: Partial<Job>[] = [];

  if (rows.length === 0) {
    errors.push({
      row: 0,
      field: 'Client Name',
      message: 'CSV file is empty or has no data rows',
      currentValue: '',
    });

    return {
      isValid: false,
      errors,
      validRows: [],
      totalRows: 0,
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    const clientName = row['Client Name'];
    if (!validateRequiredField(clientName, rowNumber, 'Client Name', errors)) {
      continue;
    }

    const jobData: Partial<Job> = {
      client_name: clientName.trim(),
      client_phone: row['Client Phone']?.trim() || null,
      client_email: row['Client Email']?.trim() || null,
      client_address: row['Client Address']?.trim() || null,
      // Left blank when the work happened at the client's address.
      service_address: row['Work Address']?.trim() || null,
      job_type: row['Job Type']?.trim() || null,
      job_description: row['Job Description']?.trim() || null,
      notes: row['Notes']?.trim() || null,
      is_active: true,
    };

    jobData.date_quoted = validateDate(row['Date Quoted'], rowNumber, 'Date Quoted', errors);
    jobData.date_scheduled = validateDate(row['Date Scheduled'], rowNumber, 'Date Scheduled', errors);
    jobData.date_completed = validateDate(row['Date Completed'], rowNumber, 'Date Completed', errors);
    jobData.payment_date = validateDate(row['Payment Date'], rowNumber, 'Payment Date', errors);

    jobData.hours_worked = validateNumber(row['Hours Worked'], rowNumber, 'Hours Worked', errors);
    jobData.quoted_price = validateNumber(row['Quoted Price'], rowNumber, 'Quoted Price', errors);
    jobData.final_price = validateNumber(row['Final Price'], rowNumber, 'Final Price', errors);
    jobData.materials_cost = validateNumber(row['Materials/Extra Cost'], rowNumber, 'Materials/Extra Cost', errors) || 0;

    jobData.location_city = validateCity(row['Location (City)'], rowNumber, serviceAreas, errors);
    jobData.payment_method = validatePaymentMethod(row['Payment Method'], rowNumber, paymentMethods, errors);
    jobData.referral_source = validateReferralSource(row['Referral Source'], rowNumber, errors);

    jobData.reviews_received = parseBoolean(row['Reviews Received']);
    jobData.google_review_link_sent = parseBoolean(row['Google Review Link Sent']);
    jobData.repeat_client = parseBoolean(row['Repeat Client']);

    validRows.push(jobData);
  }

  return {
    isValid: errors.length === 0,
    errors,
    validRows,
    totalRows: rows.length,
  };
}

export function generateErrorReportCSV(errors: ValidationError[]): string {
  const headers = ['Row', 'Field', 'Error', 'Current Value'];
  const rows = errors.map(error => {
    const values = [
      String(error.row),
      error.field,
      error.message,
      error.currentValue || '(empty)',
    ];
    return values.map(v => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    }).join(',');
  });

  return `${headers.join(',')}\n${rows.join('\n')}`;
}
