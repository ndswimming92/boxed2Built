import { supabase } from '../lib/supabase';
import type { MileageRecord } from '../lib/supabase';

export interface MileageExportOptions {
  startDate?: string;
  endDate?: string;
  jobId?: string;
  includeClaimed?: boolean;
}

export async function getMileageRecordsForExport(
  businessId: string,
  options: MileageExportOptions = {}
): Promise<MileageRecord[]> {
  let query = supabase
    .from('mileage_records')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('trip_date', { ascending: true });

  if (options.startDate) {
    query = query.gte('trip_date', options.startDate);
  }

  if (options.endDate) {
    query = query.lte('trip_date', options.endDate);
  }

  if (options.jobId) {
    query = query.eq('job_id', options.jobId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching mileage records:', error);
    return [];
  }

  return (data as MileageRecord[]) || [];
}

export function exportMileageToCSV(records: MileageRecord[]): string {
  if (records.length === 0) {
    return 'No records to export';
  }

  const headers = [
    'Date',
    'Job ID',
    'Distance (Miles)',
    'Purpose',
    'Start Time',
    'End Time',
    'IRS Rate',
    'Deduction Amount',
    'Type',
    'Notes',
  ];

  const rows = records.map(record => [
    record.trip_date,
    record.job_id,
    record.distance_miles.toFixed(2),
    record.purpose || '',
    new Date(record.start_time).toLocaleString(),
    record.end_time ? new Date(record.end_time).toLocaleString() : '',
    record.irs_rate_per_mile.toFixed(3),
    record.deduction_amount.toFixed(2),
    record.is_manual_entry ? 'Manual' : 'GPS Tracked',
    record.notes || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(field =>
        typeof field === 'string' && field.includes(',')
          ? `"${field}"`
          : field
      ).join(',')
    ),
  ].join('\n');

  return csvContent;
}

export function exportMileageToIRSFormat(records: MileageRecord[]): string {
  if (records.length === 0) {
    return 'No records to export';
  }

  const headers = [
    'Date',
    'Business Miles',
    'Business Purpose',
    'Rate Per Mile',
    'Deduction',
  ];

  const rows = records.map(record => [
    record.trip_date,
    record.distance_miles.toFixed(2),
    record.purpose || 'Business travel',
    record.irs_rate_per_mile.toFixed(3),
    record.deduction_amount.toFixed(2),
  ]);

  const totalMiles = records.reduce((sum, r) => sum + r.distance_miles, 0);
  const totalDeduction = records.reduce((sum, r) => sum + r.deduction_amount, 0);

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(field =>
        typeof field === 'string' && field.includes(',')
          ? `"${field}"`
          : field
      ).join(',')
    ),
    '',
    `Total Miles,${totalMiles.toFixed(2)},,, ${totalDeduction.toFixed(2)}`,
  ].join('\n');

  return csvContent;
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateExportFilename(prefix: string = 'mileage', format: 'standard' | 'irs' = 'standard'): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${prefix}_${format}_${year}-${month}-${day}.csv`;
}

export async function exportMileageForTaxYear(
  businessId: string,
  taxYear: number
): Promise<{ success: boolean; csv?: string; filename?: string; error?: string }> {
  try {
    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    const records = await getMileageRecordsForExport(businessId, { startDate, endDate });

    if (records.length === 0) {
      return { success: false, error: 'No mileage records found for this tax year' };
    }

    const csv = exportMileageToIRSFormat(records);
    const filename = `mileage_tax_year_${taxYear}.csv`;

    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error exporting mileage for tax year:', error);
    return { success: false, error: 'Failed to export mileage data' };
  }
}

export interface MileageSummary {
  totalTrips: number;
  totalMiles: number;
  totalDeduction: number;
  gpsTrackedTrips: number;
  manualEntries: number;
  gpsTrackedMiles: number;
  manualEntryMiles: number;
  averageTripDistance: number;
}

export function calculateMileageSummary(records: MileageRecord[]): MileageSummary {
  const gpsRecords = records.filter(r => !r.is_manual_entry);
  const manualRecords = records.filter(r => r.is_manual_entry);

  const totalMiles = records.reduce((sum, r) => sum + r.distance_miles, 0);
  const gpsTrackedMiles = gpsRecords.reduce((sum, r) => sum + r.distance_miles, 0);
  const manualEntryMiles = manualRecords.reduce((sum, r) => sum + r.distance_miles, 0);
  const totalDeduction = records.reduce((sum, r) => sum + r.deduction_amount, 0);

  return {
    totalTrips: records.length,
    totalMiles,
    totalDeduction,
    gpsTrackedTrips: gpsRecords.length,
    manualEntries: manualRecords.length,
    gpsTrackedMiles,
    manualEntryMiles,
    averageTripDistance: records.length > 0 ? totalMiles / records.length : 0,
  };
}
