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

type UserAgentData = {
  getHighEntropyValues: (hints: string[]) => Promise<{
    model?: string;
    platformVersion?: string;
    fullVersionList?: { brand: string; version: string }[];
  }>;
  brands?: { brand: string; version: string }[];
};

export type ScanDeviceContext = {
  timezone: string;
  language: string;
  screenResolution: string;
  deviceModel: string;
  osVersion: string;
  browserVersion: string;
};

/**
 * Collects what the scanning device is willing to tell us. User-Agent Client
 * Hints give the real device model and OS version on Chromium/Android, where
 * the plain user-agent string has been frozen; everything else degrades to an
 * empty string rather than failing the scan.
 */
export async function collectDeviceContext(): Promise<ScanDeviceContext> {
  const context: ScanDeviceContext = {
    timezone: '',
    language: '',
    screenResolution: '',
    deviceModel: '',
    osVersion: '',
    browserVersion: ''
  };

  if (typeof window === 'undefined') return context;

  try {
    context.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    // Timezone is best-effort.
  }

  context.language = navigator.language || '';

  if (window.screen) {
    const ratio = window.devicePixelRatio && window.devicePixelRatio !== 1
      ? ` @${window.devicePixelRatio}x`
      : '';
    context.screenResolution = `${window.screen.width}x${window.screen.height}${ratio}`;
  }

  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (uaData) {
    try {
      const hints = await uaData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']);
      context.deviceModel = hints.model || '';
      context.osVersion = hints.platformVersion || '';

      // The last brand in fullVersionList is the actual browser; the earlier
      // entries are the deliberately-nonsensical GREASE brands plus Chromium.
      const brands = hints.fullVersionList?.filter((entry) => !/not.a.brand/i.test(entry.brand));
      context.browserVersion = brands?.[brands.length - 1]?.version || '';
    } catch {
      // Client hints are permission-gated in some browsers; ignore refusals.
    }
  }

  return context;
}

export type LogScanParams = {
  qrCodeId: string;
  slug: string;
  destinationUrl: string;
  userAgent: string;
  referrer: string;
  pageUrl: string;
};

/**
 * Falls back to a direct insert when the edge function is unreachable, so a
 * scan is still counted even if the notification email cannot be sent.
 */
async function insertScanDirectly(params: LogScanParams): Promise<void> {
  const { device_type, browser, os } = parseUserAgent(params.userAgent);
  const { utm_source, utm_medium, utm_campaign } = extractUTMParams(params.pageUrl);

  const { error } = await supabase.from('qr_scans').insert({
    qr_code_id: params.qrCodeId,
    user_agent: params.userAgent,
    device_type,
    browser,
    os,
    referrer: params.referrer,
    destination_url: params.destinationUrl,
    utm_source,
    utm_medium,
    utm_campaign,
    ip_address: '',
    country: '',
    city: ''
  });

  if (error) {
    console.error('Error logging scan:', error);
  }
}

/**
 * Records a scan through the notify-qr-scan edge function, which resolves the
 * IP and location the browser cannot see, then emails the business with the
 * code's running scan total and the device details.
 */
export async function logScan(params: LogScanParams): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    await insertScanDirectly(params);
    return;
  }

  try {
    const device = await collectDeviceContext();

    const res = await fetch(`${supabaseUrl}/functions/v1/notify-qr-scan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        slug: params.slug,
        qrCodeId: params.qrCodeId,
        destinationUrl: params.destinationUrl,
        referrer: params.referrer,
        pageUrl: params.pageUrl,
        userAgent: params.userAgent,
        ...device
      }),
      // Let the request finish even though we redirect away immediately after.
      keepalive: true
    });

    if (!res.ok) {
      throw new Error(`notify-qr-scan responded ${res.status}`);
    }
  } catch (error) {
    console.error('Error notifying scan, falling back to direct insert:', error);
    await insertScanDirectly(params);
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
    count: Number(count),
    percentage: Math.round((Number(count) / scans.length) * 100)
  }));

  const referrerCounts = scans
    .filter(s => s.referrer && s.referrer !== '')
    .reduce((acc, scan) => {
      const ref = scan.referrer;
      acc[ref] = (acc[ref] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const top_referrers: TopReferrer[] = Object.entries(referrerCounts)
    .map(([referrer, count]) => ({ referrer, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const dateCounts = scans.reduce((acc, scan) => {
    const date = scan.scanned_at.split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const time_series: ScanTimeSeries[] = Object.entries(dateCounts)
    .map(([date, scans]) => ({ date, scans: Number(scans) }))
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

export async function resetQRCodeScans(qrCodeId: string): Promise<void> {
  const { error } = await supabase
    .from('qr_scans')
    .delete()
    .eq('qr_code_id', qrCodeId);

  if (error) throw error;
}

export async function exportScanDataToCSV(qrCodeId: string): Promise<string> {
  const scans = await getScansForQRCode(qrCodeId, 10000);

  const headers = [
    'Scanned At',
    'Device Type',
    'Device Model',
    'Browser',
    'Browser Version',
    'OS',
    'OS Version',
    'Screen',
    'Language',
    'Device Timezone',
    'Referrer',
    'Destination URL',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    'IP Address',
    'City',
    'Region',
    'Country',
    'Bot',
    'Notified At'
  ];

  const rows = scans.map(scan => [
    scan.scanned_at,
    scan.device_type,
    scan.device_model,
    scan.browser,
    scan.browser_version,
    scan.os,
    scan.os_version,
    scan.screen_resolution,
    scan.language,
    scan.timezone,
    scan.referrer,
    scan.destination_url,
    scan.utm_source,
    scan.utm_medium,
    scan.utm_campaign,
    scan.ip_address,
    scan.city,
    scan.region,
    scan.country,
    scan.is_bot ? 'yes' : 'no',
    scan.notification_sent_at ?? ''
  ]);

  const csvContent = [
    headers.join(','),
    // Escape embedded quotes so a user agent or URL cannot break out of its cell.
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}
