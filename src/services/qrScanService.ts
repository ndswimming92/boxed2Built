import { supabase, QRScan } from '../lib/supabase';

export type DeviceBreakdown = {
  device_type: string;
  count: number;
  percentage: number;
};

export type ScanTimeSeries = {
  date: string;
  scans: number;
};

export type TopReferrer = {
  referrer: string;
  count: number;
};

export type ScanAnalytics = {
  total_scans: number;
  unique_scans: number;
  device_breakdown: DeviceBreakdown[];
  top_referrers: TopReferrer[];
  recent_scans: QRScan[];
  time_series: ScanTimeSeries[];
};

function parseUserAgent(userAgent: string): { device_type: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase();

  let device_type = 'desktop';
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    device_type = 'tablet';
  } else if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    device_type = 'mobile';
  }

  let browser = 'Unknown';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari')) browser = 'Safari';

  let os = 'Unknown';
  if (ua.includes('win')) os = 'Windows';
  else if (ua.includes('mac')) os = 'MacOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { device_type, browser, os };
}

function extractUTMParams(url: string): { utm_source: string; utm_medium: string; utm_campaign: string } {
  try {
    const urlObj = new URL(url);
    return {
      utm_source: urlObj.searchParams.get('utm_source') || '',
      utm_medium: urlObj.searchParams.get('utm_medium') || '',
      utm_campaign: urlObj.searchParams.get('utm_campaign') || ''
    };
  } catch {
    return { utm_source: '', utm_medium: '', utm_campaign: '' };
  }
}

export async function logScan(
  qrCodeId: string,
  userAgent: string,
  referrer: string,
  fullURL: string
): Promise<void> {
  const { device_type, browser, os } = parseUserAgent(userAgent);
  const { utm_source, utm_medium, utm_campaign } = extractUTMParams(fullURL);

  const scanData = {
    qr_code_id: qrCodeId,
    user_agent: userAgent,
    device_type,
    browser,
    os,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
    ip_address: '',
    country: '',
    city: ''
  };

  const { error } = await supabase
    .from('qr_scans')
    .insert(scanData);

  if (error) {
    console.error('Error logging scan:', error);
  }
}

export async function getScanAnalytics(
  qrCodeId: string,
  startDate?: string,
  endDate?: string
): Promise<ScanAnalytics> {
  let query = supabase
    .from('qr_scans')
    .select('*')
    .eq('qr_code_id', qrCodeId);

  if (startDate) {
    query = query.gte('scanned_at', startDate);
  }
  if (endDate) {
    query = query.lte('scanned_at', endDate);
  }

  const { data: scans, error } = await query.order('scanned_at', { ascending: false });

  if (error) throw error;
  if (!scans || scans.length === 0) {
    return {
      total_scans: 0,
      unique_scans: 0,
      device_breakdown: [],
      top_referrers: [],
      recent_scans: [],
      time_series: []
    };
  }

  const uniqueScans = new Set(scans.map(s => `${s.ip_address}-${s.user_agent}`)).size;

  const deviceCounts = scans.reduce((acc, scan) => {
    const device = scan.device_type || 'Unknown';
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const device_breakdown: DeviceBreakdown[] = Object.entries(deviceCounts).map(([device, count]) => ({
    device_type: device,
    count,
    percentage: Math.round((count / scans.length) * 100)
  }));

  const referrerCounts = scans
    .filter(s => s.referrer && s.referrer !== '')
    .reduce((acc, scan) => {
      const ref = scan.referrer;
      acc[ref] = (acc[ref] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const top_referrers: TopReferrer[] = Object.entries(referrerCounts)
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const dateCounts = scans.reduce((acc, scan) => {
    const date = scan.scanned_at.split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const time_series: ScanTimeSeries[] = Object.entries(dateCounts)
    .map(([date, scans]) => ({ date, scans }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total_scans: scans.length,
    unique_scans: uniqueScans,
    device_breakdown,
    top_referrers,
    recent_scans: scans.slice(0, 20),
    time_series
  };
}

export async function getScansForQRCode(
  qrCodeId: string,
  limit = 50,
  offset = 0
): Promise<QRScan[]> {
  const { data, error } = await supabase
    .from('qr_scans')
    .select('*')
    .eq('qr_code_id', qrCodeId)
    .order('scanned_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function exportScanDataToCSV(qrCodeId: string): Promise<string> {
  const scans = await getScansForQRCode(qrCodeId, 10000);

  const headers = [
    'Scanned At',
    'Device Type',
    'Browser',
    'OS',
    'Referrer',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    'Country',
    'City'
  ];

  const rows = scans.map(scan => [
    scan.scanned_at,
    scan.device_type,
    scan.browser,
    scan.os,
    scan.referrer,
    scan.utm_source,
    scan.utm_medium,
    scan.utm_campaign,
    scan.country,
    scan.city
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}
