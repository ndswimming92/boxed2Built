import { Job } from '../lib/supabase';

export interface JobCSVRow {
  'Client Name': string;
  'Client Phone': string;
  'Client Email': string;
  'Job Type': string;
  'Job Description': string;
  'Status': string;
  'Date Quoted': string;
  'Date Scheduled': string;
  'Date Completed': string;
  'Lost Reason Category': string;
  'Lost Reason Notes': string;
  'Status Changed At': string;
  'Hours Worked': string;
  'Quoted Price': string;
  'Final Price': string;
  'Materials/Extra Cost': string;
  'Def': string;
  'Location (City)': string;
  'State': string;
  'Location (City) State': string;
  'Payment Method': string;
  'Payment Date': string;
  'Reviews Received': string;
  'Google Review Link Sent': string;
  'Repeat Client': string;
  'Referral Source': string;
  'Notes': string;
}

const CSV_HEADERS: (keyof JobCSVRow)[] = [
  'Client Name',
  'Client Phone',
  'Client Email',
  'Job Type',
  'Job Description',
  'Status',
  'Date Quoted',
  'Date Scheduled',
  'Date Completed',
  'Lost Reason Category',
  'Lost Reason Notes',
  'Status Changed At',
  'Hours Worked',
  'Quoted Price',
  'Final Price',
  'Materials/Extra Cost',
  'Def',
  'Location (City)',
  'State',
  'Location (City) State',
  'Payment Method',
  'Payment Date',
  'Reviews Received',
  'Google Review Link Sent',
  'Repeat Client',
  'Referral Source',
  'Notes',
];

function formatDateForExport(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return '';
  }
}

function formatNumberForExport(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  return String(num);
}

function formatBooleanForExport(bool: boolean | null | undefined): string {
  if (bool === null || bool === undefined) return '';
  return bool ? 'Yes' : 'No';
}

function escapeCSVValue(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function jobToCSVRow(job: Job): JobCSVRow {
  const city = job.location_city || '';
  const state = '';
  const cityState = city && state ? `${city}, ${state}` : city;

  const statusLabels: Record<string, string> = {
    'quoted': 'Quoted',
    'accepted': 'Accepted',
    'scheduled': 'Scheduled',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'lost': 'Lost',
    'cancelled': 'Cancelled',
  };

  return {
    'Client Name': job.client_name || '',
    'Client Phone': job.client_phone || '',
    'Client Email': job.client_email || '',
    'Job Type': job.job_type || '',
    'Job Description': job.job_description || '',
    'Status': statusLabels[job.job_status] || job.job_status,
    'Date Quoted': formatDateForExport(job.date_quoted),
    'Date Scheduled': formatDateForExport(job.date_scheduled),
    'Date Completed': formatDateForExport(job.date_completed),
    'Lost Reason Category': job.lost_reason_category || '',
    'Lost Reason Notes': job.lost_reason_notes || '',
    'Status Changed At': formatDateForExport(job.status_changed_at),
    'Hours Worked': formatNumberForExport(job.hours_worked),
    'Quoted Price': formatNumberForExport(job.quoted_price),
    'Final Price': formatNumberForExport(job.final_price),
    'Materials/Extra Cost': formatNumberForExport(job.materials_cost),
    'Def': '',
    'Location (City)': city,
    'State': state,
    'Location (City) State': cityState,
    'Payment Method': job.payment_method || '',
    'Payment Date': formatDateForExport(job.payment_date),
    'Reviews Received': formatBooleanForExport(job.reviews_received),
    'Google Review Link Sent': formatBooleanForExport(job.google_review_link_sent),
    'Repeat Client': formatBooleanForExport(job.repeat_client),
    'Referral Source': job.referral_source || '',
    'Notes': job.notes || '',
  };
}

export function generateCSVTemplate(): string {
  const headers = CSV_HEADERS.join(',');
  const exampleRow: JobCSVRow = {
    'Client Name': 'John Smith',
    'Client Phone': '615-555-0123',
    'Client Email': 'john.smith@example.com',
    'Job Type': 'Furniture Assembly',
    'Job Description': 'Assemble office desk and filing cabinet',
    'Status': 'Completed',
    'Date Quoted': '1/15/2025',
    'Date Scheduled': '1/20/2025',
    'Date Completed': '1/20/2025',
    'Lost Reason Category': '',
    'Lost Reason Notes': '',
    'Status Changed At': '1/20/2025',
    'Hours Worked': '2.5',
    'Quoted Price': '150',
    'Final Price': '150',
    'Materials/Extra Cost': '0',
    'Def': '',
    'Location (City)': 'Spring Hill',
    'State': 'TN',
    'Location (City) State': 'Spring Hill, TN',
    'Payment Method': 'Cash',
    'Payment Date': '1/20/2025',
    'Reviews Received': 'Yes',
    'Google Review Link Sent': 'Yes',
    'Repeat Client': 'No',
    'Referral Source': 'Google',
    'Notes': 'Client was very satisfied',
  };

  const exampleValues = CSV_HEADERS.map(header => escapeCSVValue(exampleRow[header]));
  return `${headers}\n${exampleValues.join(',')}`;
}

export function exportJobsToCSV(jobs: Job[]): string {
  const headers = CSV_HEADERS.join(',');
  const rows = jobs.map(job => {
    const csvRow = jobToCSVRow(job);
    const values = CSV_HEADERS.map(header => escapeCSVValue(csvRow[header]));
    return values.join(',');
  });

  return `${headers}\n${rows.join('\n')}`;
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateExportFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `jobs-export-${year}-${month}-${day}-${hours}${minutes}${seconds}.csv`;
}
