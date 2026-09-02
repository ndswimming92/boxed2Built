import {
  supabase,
  Booking,
  BookingAvailabilityRule,
  BookingDateOverride,
  BookingPageConfig,
  BookingPublicInfo,
  BookingSettings,
  BookingSlot,
  BookingStatus,
} from '../lib/supabase';

/**
 * Bookings never read `jobs`, `booking_settings` or each other directly — the
 * customer has no rights to any of it. Everything the public page needs comes
 * back from SECURITY DEFINER functions that return times and nothing else.
 */

const FURNITURE_PHOTO_BUCKET = 'furniture-photos';

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface CreateBookingInput {
  bookingDate: string;
  startTime: string;
  customerName: string;
  serviceId?: string | null;
  pieces?: number | null;
  customerPhone?: string | null;
  serviceAddress?: string | null;
  notes?: string | null;
  photoPaths?: string[];
}

export interface CreateBookingResult {
  id: string;
  reference: string;
  status: BookingStatus;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  job_id: string | null;
  confirmation_message: string;
}

export interface MyBooking {
  id: string;
  reference: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: BookingStatus;
  service_name: string | null;
  pieces: number | null;
  notes: string | null;
  created_at: string;
}

// ── Public booking page ──────────────────────────────────────────────────────

/**
 * The booking policy, readable without signing in. Everything else on this page
 * is authenticated-only, which left the page unable to describe itself: a
 * visitor had to hand over a Google account before finding out how far ahead
 * they could book, whether a request is confirmed straight away, or even
 * whether booking was open at all.
 *
 * Availability, jobs and other people's bookings stay behind the sign-in.
 */
export async function getBookingPublicInfo(): Promise<BookingPublicInfo> {
  const { data, error } = await supabase.rpc('get_booking_public_info');

  if (error) throw new Error(error.message);

  return (data as BookingPublicInfo) ?? { is_enabled: false };
}


export async function getBookingPageConfig(): Promise<BookingPageConfig> {
  const { data, error } = await supabase.rpc('get_booking_page_config');

  if (error) throw new Error(error.message);

  return (data as BookingPageConfig) ?? { is_enabled: false };
}

/**
 * Bookable start times between two dates. Omitting the range asks for the whole
 * window the owner allows; the server clamps it either way, so a wide request
 * can never see further ahead than `max_advance_days`.
 */
export async function getAvailableSlots(
  from?: string,
  to?: string,
  durationMinutes?: number,
): Promise<BookingSlot[]> {
  const { data, error } = await supabase.rpc('get_available_booking_slots', {
    p_from: from ?? null,
    p_to: to ?? null,
    p_duration_minutes: durationMinutes ?? null,
  });

  if (error) throw new Error(error.message);

  return (data as BookingSlot[]) ?? [];
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { data, error } = await supabase.rpc('create_booking', {
    p_booking_date: input.bookingDate,
    p_start_time: input.startTime,
    p_customer_name: input.customerName,
    p_service_id: input.serviceId ?? null,
    p_pieces: input.pieces ?? null,
    p_customer_phone: input.customerPhone ?? null,
    p_service_address: input.serviceAddress ?? null,
    p_notes: input.notes ?? null,
    p_photo_paths: input.photoPaths ?? [],
  });

  if (error) throw new Error(error.message);

  return data as CreateBookingResult;
}

/**
 * A booking as the customer sees it on the request lookup page. The RPC checks
 * the email and the reference together, so nothing here is reachable by guessing
 * a code alone.
 */
export interface BookingLookupResult {
  reference: string;
  status: BookingStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  service_address: string | null;
  service_name: string | null;
  pieces: number | null;
  notes: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  cancellation_reason: string | null;
  created_at: string;
}

/** Booking references are `BK-` followed by six characters. */
export function looksLikeBookingReference(code: string): boolean {
  return /^BK-?[A-Z0-9]{6}$/i.test(code.trim());
}

export async function lookupBookingByCode(
  email: string,
  reference: string,
): Promise<BookingLookupResult | null> {
  const { data, error } = await supabase.rpc('lookup_booking_by_code', {
    p_email: email.trim().toLowerCase(),
    p_confirmation_code: reference.replace(/\s/g, '').toUpperCase(),
  });

  if (error) throw new Error(error.message);

  const record = (Array.isArray(data) ? data[0] : data) ?? null;
  return (record as BookingLookupResult) ?? null;
}

export async function getMyBookings(): Promise<MyBooking[]> {
  const { data, error } = await supabase.rpc('get_my_bookings');

  if (error) throw new Error(error.message);

  return (data as MyBooking[]) ?? [];
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason ?? null,
  });

  if (error) throw new Error(error.message);
}

/** Uploads to the same bucket the quote form uses; returns storage paths, not URLs. */
export async function uploadBookingPhotos(businessKey: string, files: File[]): Promise<string[]> {
  const paths: string[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${businessKey}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(FURNITURE_PHOTO_BUCKET)
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (error) throw new Error(error.message);
    if (data) paths.push(data.path);
  }

  return paths;
}

export function getBookingPhotoUrl(path: string): string {
  const { data } = supabase.storage.from(FURNITURE_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Admin: settings ──────────────────────────────────────────────────────────

export async function getBookingSettings(businessId: string): Promise<BookingSettings | null> {
  const { data, error } = await supabase
    .from('booking_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data as BookingSettings | null;
}

/**
 * The settings row is seeded by migration, but a business created afterwards
 * would have none, so the admin page can create it on first save.
 */
export async function ensureBookingSettings(
  businessId: string,
  organizationId: string | null,
): Promise<BookingSettings> {
  const existing = await getBookingSettings(businessId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('booking_settings')
    .insert([{ business_id: businessId, organization_id: organizationId }])
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return data as BookingSettings;
}

export async function updateBookingSettings(
  id: string,
  patch: Partial<BookingSettings>,
): Promise<void> {
  const { error } = await supabase.from('booking_settings').update(patch).eq('id', id);

  if (error) throw new Error(error.message);
}

// ── Admin: weekly availability ───────────────────────────────────────────────

export async function getAvailabilityRules(businessId: string): Promise<BookingAvailabilityRule[]> {
  const { data, error } = await supabase
    .from('booking_availability_rules')
    .select('*')
    .eq('business_id', businessId)
    .order('day_of_week')
    .order('start_time');

  if (error) throw new Error(error.message);

  return (data as BookingAvailabilityRule[]) ?? [];
}

export interface AvailabilityWindowInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

/**
 * The weekly grid is edited as a whole, so it is written as a whole: the old
 * rows go and the current ones replace them. Far less error-prone than diffing
 * a set of windows the owner may have split, merged or dragged around.
 */
export async function replaceAvailabilityRules(
  businessId: string,
  organizationId: string | null,
  windows: AvailabilityWindowInput[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('booking_availability_rules')
    .delete()
    .eq('business_id', businessId);

  if (deleteError) throw new Error(deleteError.message);

  if (windows.length === 0) return;

  const { error } = await supabase.from('booking_availability_rules').insert(
    windows.map((window) => ({
      business_id: businessId,
      organization_id: organizationId,
      day_of_week: window.day_of_week,
      start_time: window.start_time,
      end_time: window.end_time,
      is_active: window.is_active,
    })),
  );

  if (error) throw new Error(error.message);
}

// ── Admin: date overrides ────────────────────────────────────────────────────

export async function getDateOverrides(
  businessId: string,
  fromDate?: string,
): Promise<BookingDateOverride[]> {
  let query = supabase
    .from('booking_date_overrides')
    .select('*')
    .eq('business_id', businessId)
    .order('override_date');

  if (fromDate) query = query.gte('override_date', fromDate);

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data as BookingDateOverride[]) ?? [];
}

export interface DateOverrideInput {
  override_date: string;
  is_blocked: boolean;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
}

export async function saveDateOverride(
  businessId: string,
  organizationId: string | null,
  input: DateOverrideInput,
): Promise<void> {
  // One override per date: replacing beats stacking, since two rows for the
  // same day would make "which hours apply" ambiguous.
  const { error: deleteError } = await supabase
    .from('booking_date_overrides')
    .delete()
    .eq('business_id', businessId)
    .eq('override_date', input.override_date);

  if (deleteError) throw new Error(deleteError.message);

  const { error } = await supabase.from('booking_date_overrides').insert([
    {
      business_id: businessId,
      organization_id: organizationId,
      override_date: input.override_date,
      is_blocked: input.is_blocked,
      start_time: input.is_blocked ? null : input.start_time,
      end_time: input.is_blocked ? null : input.end_time,
      note: input.note ?? null,
    },
  ]);

  if (error) throw new Error(error.message);
}

export async function deleteDateOverride(id: string): Promise<void> {
  const { error } = await supabase.from('booking_date_overrides').delete().eq('id', id);

  if (error) throw new Error(error.message);
}

// ── Admin: the booking queue ─────────────────────────────────────────────────

export interface BookingFilters {
  status?: BookingStatus | 'all';
  fromDate?: string;
  toDate?: string;
  searchTerm?: string;
}

export async function getBookings(filters: BookingFilters = {}): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select('*')
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.fromDate) query = query.gte('booking_date', filters.fromDate);
  if (filters.toDate) query = query.lte('booking_date', filters.toDate);

  if (filters.searchTerm) {
    const term = `%${filters.searchTerm}%`;
    query = query.or(
      `customer_name.ilike.${term},customer_email.ilike.${term},reference.ilike.${term}`,
    );
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data as Booking[]) ?? [];
}

export async function getPendingBookingCount(): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw new Error(error.message);

  return count ?? 0;
}

/** Accepting a booking is what creates the job; the RPC does both atomically. */
export async function confirmBooking(bookingId: string, note?: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('confirm_booking', {
    p_booking_id: bookingId,
    p_note: note ?? null,
  });

  if (error) throw new Error(error.message);

  return (data as { job_id: string | null })?.job_id ?? null;
}

export async function declineBooking(bookingId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('decline_booking', {
    p_booking_id: bookingId,
    p_reason: reason ?? null,
  });

  if (error) throw new Error(error.message);
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** '13:30:00' -> '1:30 PM'. */
export function formatTimeLabel(time: string): string {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;

  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute.toString().padStart(2, '0');

  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * '2026-09-14' -> 'Monday, September 14, 2026'. Parsed as UTC so a date-only
 * value never slips a day for viewers west of the meridian.
 */
export function formatDateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  },
): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    ...options,
    timeZone: 'UTC',
  });
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  return `${hours}h ${remainder}m`;
}

/** Local YYYY-MM-DD. `toISOString()` would shift the day for western zones. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
