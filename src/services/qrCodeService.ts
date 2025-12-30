import { supabase, QRCode, QRCodeSchedule } from '../lib/supabase';

export type QRCodeWithSchedules = QRCode & {
  schedules: QRCodeSchedule[];
  scan_count?: number;
};

export type QRCodeStats = {
  total_codes: number;
  active_codes: number;
  inactive_codes: number;
  total_scans: number;
};

export async function getAllQRCodes(businessId: string): Promise<QRCodeWithSchedules[]> {
  const { data: qrCodes, error: qrError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (qrError) throw qrError;
  if (!qrCodes) return [];

  const qrCodesWithData = await Promise.all(
    qrCodes.map(async (qr) => {
      const [schedulesResult, scanCountResult] = await Promise.all([
        supabase
          .from('qr_code_schedules')
          .select('*')
          .eq('qr_code_id', qr.id)
          .order('priority', { ascending: false }),
        supabase
          .from('qr_scans')
          .select('*', { count: 'exact', head: true })
          .eq('qr_code_id', qr.id)
      ]);

      return {
        ...qr,
        schedules: schedulesResult.data || [],
        scan_count: scanCountResult.count || 0
      };
    })
  );

  return qrCodesWithData;
}

export async function getQRCode(id: string): Promise<QRCodeWithSchedules | null> {
  const { data: qrCode, error: qrError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (qrError) throw qrError;
  if (!qrCode) return null;

  const [schedulesResult, scanCountResult] = await Promise.all([
    supabase
      .from('qr_code_schedules')
      .select('*')
      .eq('qr_code_id', qrCode.id)
      .order('priority', { ascending: false }),
    supabase
      .from('qr_scans')
      .select('*', { count: 'exact', head: true })
      .eq('qr_code_id', qrCode.id)
  ]);

  return {
    ...qrCode,
    schedules: schedulesResult.data || [],
    scan_count: scanCountResult.count || 0
  };
}

export async function getQRCodeBySlug(slug: string): Promise<QRCodeWithSchedules | null> {
  const { data: qrCode, error: qrError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (qrError) throw qrError;
  if (!qrCode) return null;

  const { data: schedules } = await supabase
    .from('qr_code_schedules')
    .select('*')
    .eq('qr_code_id', qrCode.id)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  return {
    ...qrCode,
    schedules: schedules || []
  };
}

export async function checkSlugAvailability(slug: string, excludeId?: string): Promise<boolean> {
  let query = supabase
    .from('qr_codes')
    .select('id')
    .eq('slug', slug);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data === null;
}

export async function createQRCode(
  businessId: string,
  qrCode: Omit<QRCode, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<QRCode> {
  const { data, error } = await supabase
    .from('qr_codes')
    .insert({
      business_id: businessId,
      ...qrCode
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateQRCode(
  id: string,
  updates: Partial<Omit<QRCode, 'id' | 'business_id' | 'created_at' | 'updated_at'>>
): Promise<QRCode> {
  const { data, error } = await supabase
    .from('qr_codes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteQRCode(id: string): Promise<void> {
  const { error } = await supabase
    .from('qr_codes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleQRCodeStatus(id: string, status: 'active' | 'inactive'): Promise<QRCode> {
  return updateQRCode(id, { status });
}

export async function duplicateQRCode(id: string, newSlug: string, newTitle: string): Promise<QRCode> {
  const original = await getQRCode(id);
  if (!original) throw new Error('QR code not found');

  const { data: newQRCode, error: qrError } = await supabase
    .from('qr_codes')
    .insert({
      business_id: original.business_id,
      slug: newSlug,
      title: newTitle,
      description: original.description,
      default_destination_url: original.default_destination_url,
      status: 'inactive'
    })
    .select()
    .single();

  if (qrError) throw qrError;

  if (original.schedules && original.schedules.length > 0) {
    const scheduleInserts = original.schedules.map(schedule => ({
      qr_code_id: newQRCode.id,
      destination_url: schedule.destination_url,
      start_datetime: schedule.start_datetime,
      end_datetime: schedule.end_datetime,
      priority: schedule.priority,
      is_active: false
    }));

    await supabase.from('qr_code_schedules').insert(scheduleInserts);
  }

  return newQRCode;
}

export async function createSchedule(
  schedule: Omit<QRCodeSchedule, 'id' | 'created_at' | 'updated_at'>
): Promise<QRCodeSchedule> {
  const { data, error } = await supabase
    .from('qr_code_schedules')
    .insert(schedule)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSchedule(
  id: string,
  updates: Partial<Omit<QRCodeSchedule, 'id' | 'qr_code_id' | 'created_at' | 'updated_at'>>
): Promise<QRCodeSchedule> {
  const { data, error } = await supabase
    .from('qr_code_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('qr_code_schedules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveScheduleForQRCode(qrCodeId: string): Promise<QRCodeSchedule | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('qr_code_schedules')
    .select('*')
    .eq('qr_code_id', qrCodeId)
    .eq('is_active', true)
    .lte('start_datetime', now)
    .gte('end_datetime', now)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getQRCodeStats(businessId: string): Promise<QRCodeStats> {
  const [
    totalCodesResult,
    activeCodesResult,
    inactiveCodesResult,
    totalScansResult
  ] = await Promise.all([
    supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId),
    supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'active'),
    supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'inactive'),
    supabase
      .from('qr_scans')
      .select('qr_code_id', { count: 'exact', head: true })
      .in('qr_code_id',
        supabase
          .from('qr_codes')
          .select('id')
          .eq('business_id', businessId)
      )
  ]);

  return {
    total_codes: totalCodesResult.count || 0,
    active_codes: activeCodesResult.count || 0,
    inactive_codes: inactiveCodesResult.count || 0,
    total_scans: totalScansResult.count || 0
  };
}

export function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

export function getShortURL(slug: string): string {
  const baseURL = window.location.origin;
  return `${baseURL}/go/${slug}`;
}
