import { supabase, FormInquiry } from '../lib/supabase';

export interface CreateInquiryData {
  business_id: string;
  organization_id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  furniture_type: string;
  pieces: number;
  preferred_date?: string;
  preferred_time_slot?: string;
  notes?: string;
  user_city?: string;
  estimated_price?: string;
  estimated_time?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referral_source?: string;
  referral_code_used?: string;
  source?: string;
  furniture_photo_url?: string;
  furniture_image_path?: string;
  is_test?: boolean;
}

export interface UpdateInquiryData {
  viewed?: boolean;
  status?: 'pending' | 'converted_to_job' | 'archived';
  converted_job_id?: string;
  last_contact_date?: string;
  contact_method?: string;
  contact_notes?: string;
  response_count?: number;
}

export interface InquiryFilters {
  status?: 'pending' | 'converted_to_job' | 'archived' | 'all';
  viewed?: boolean;
  furniture_type?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  includeTestData?: boolean;
}

export async function createInquiry(data: CreateInquiryData): Promise<FormInquiry> {
  const inquiryId = crypto.randomUUID();

  const insertPayload = {
    id: inquiryId,
    business_id: data.business_id,
    organization_id: data.organization_id,
    client_name: data.client_name,
    client_email: data.client_email,
    client_phone: data.client_phone || null,
    furniture_type: data.furniture_type,
    pieces: data.pieces,
    preferred_date: data.preferred_date || null,
    preferred_time_slot: data.preferred_time_slot || null,
    notes: data.notes || null,
    user_city: data.user_city || null,
    estimated_price: data.estimated_price || null,
    estimated_time: data.estimated_time || null,
    utm_source: data.utm_source || null,
    utm_medium: data.utm_medium || null,
    utm_campaign: data.utm_campaign || null,
    referral_source: data.referral_source || null,
    referral_code_used: data.referral_code_used || null,
    source: data.source || 'contact_form',
    status: 'pending' as const,
    viewed: false,
    response_count: 0,
    is_active: true,
    is_test: data.is_test ?? false,
    furniture_photo_url: data.furniture_photo_url || null,
    furniture_image_path: data.furniture_image_path || null,
  };

  const { error } = await supabase
    .from('form_inquiries')
    .insert(insertPayload);

  if (error) {
    console.error('Error creating inquiry:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Insert data:', JSON.stringify(insertPayload, null, 2));
    throw new Error(`Failed to create inquiry: ${error.message}`);
  }

  return {
    ...insertPayload,
    submission_date: new Date().toISOString(),
    converted_job_id: null,
    last_contact_date: null,
    contact_method: null,
    contact_notes: null,
    furniture_photo_url: data.furniture_photo_url || null,
    furniture_image_path: data.furniture_image_path || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as FormInquiry;
}

export async function getInquiries(
  businessId: string,
  filters?: InquiryFilters
): Promise<FormInquiry[]> {
  let query = supabase
    .from('form_inquiries')
    .select(`
      *,
      saved_requests!left(confirmation_code)
    `)
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (!filters?.includeTestData) {
    query = query.eq('is_test', false);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.viewed !== undefined) {
    query = query.eq('viewed', filters.viewed);
  }

  if (filters?.furniture_type) {
    query = query.eq('furniture_type', filters.furniture_type);
  }

  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    query = query.or(
      `client_name.ilike.%${term}%,client_email.ilike.%${term}%,client_phone.ilike.%${term}%`
    );
  }

  if (filters?.startDate) {
    query = query.gte('submission_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('submission_date', filters.endDate);
  }

  query = query.order('submission_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching inquiries:', error);
    throw new Error(`Failed to fetch inquiries: ${error.message}`);
  }

  const inquiries = (data || []).map((item: any) => ({
    ...item,
    confirmation_code: item.saved_requests?.[0]?.confirmation_code || null,
    saved_requests: undefined,
  }));

  return inquiries as FormInquiry[];
}

export async function getInquiryById(id: string): Promise<FormInquiry | null> {
  const { data, error } = await supabase
    .from('form_inquiries')
    .select(`
      *,
      saved_requests!left(confirmation_code)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching inquiry:', error);
    throw new Error(`Failed to fetch inquiry: ${error.message}`);
  }

  if (!data) return null;

  const inquiry = {
    ...data,
    confirmation_code: data.saved_requests?.[0]?.confirmation_code || null,
    saved_requests: undefined,
  };

  return inquiry as FormInquiry;
}

export async function updateInquiry(
  id: string,
  updates: UpdateInquiryData
): Promise<FormInquiry> {
  const { data, error } = await supabase
    .from('form_inquiries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating inquiry:', error);
    throw new Error(`Failed to update inquiry: ${error.message}`);
  }

  return data as FormInquiry;
}

export async function markAsViewed(id: string): Promise<void> {
  const { error } = await supabase
    .from('form_inquiries')
    .update({ viewed: true })
    .eq('id', id);

  if (error) {
    console.error('Error marking inquiry as viewed:', error);
    throw new Error(`Failed to mark inquiry as viewed: ${error.message}`);
  }
}

export async function archiveInquiry(id: string): Promise<void> {
  const { error } = await supabase
    .from('form_inquiries')
    .update({ status: 'archived' })
    .eq('id', id);

  if (error) {
    console.error('Error archiving inquiry:', error);
    throw new Error(`Failed to archive inquiry: ${error.message}`);
  }
}

export async function deleteInquiry(id: string): Promise<void> {
  const { error } = await supabase
    .from('form_inquiries')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting inquiry:', error);
    throw new Error(`Failed to delete inquiry: ${error.message}`);
  }
}

export async function convertToJob(
  id: string,
  jobId: string
): Promise<FormInquiry> {
  const { data, error } = await supabase
    .from('form_inquiries')
    .update({
      status: 'converted_to_job',
      converted_job_id: jobId,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error converting inquiry to job:', error);
    throw new Error(`Failed to convert inquiry: ${error.message}`);
  }

  return data as FormInquiry;
}

export async function logCommunication(
  id: string,
  method: 'email' | 'sms' | 'phone',
  notes?: string
): Promise<FormInquiry> {
  const inquiry = await getInquiryById(id);
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }

  const newNotes = notes
    ? inquiry.contact_notes
      ? `${inquiry.contact_notes}\n\n[${new Date().toLocaleString()}] ${method.toUpperCase()}: ${notes}`
      : `[${new Date().toLocaleString()}] ${method.toUpperCase()}: ${notes}`
    : inquiry.contact_notes;

  const { data, error } = await supabase
    .from('form_inquiries')
    .update({
      last_contact_date: new Date().toISOString(),
      contact_method: method,
      contact_notes: newNotes,
      response_count: inquiry.response_count + 1,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error logging communication:', error);
    throw new Error(`Failed to log communication: ${error.message}`);
  }

  return data as FormInquiry;
}

export async function getUnviewedCount(businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from('form_inquiries')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('viewed', false)
    .eq('is_test', false);

  if (error) {
    console.error('Error getting unviewed count:', error);
    return 0;
  }

  return count || 0;
}

export async function getInquiryStats(businessId: string, includeTestData = false) {
  let query = supabase
    .from('form_inquiries')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (!includeTestData) {
    query = query.eq('is_test', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching inquiry stats:', error);
    return {
      total: 0,
      pending: 0,
      converted: 0,
      archived: 0,
      conversionRate: 0,
    };
  }

  const inquiries = data || [];
  const total = inquiries.length;
  const pending = inquiries.filter((i) => i.status === 'pending').length;
  const converted = inquiries.filter((i) => i.status === 'converted_to_job').length;
  const archived = inquiries.filter((i) => i.status === 'archived').length;
  const conversionRate = total > 0 ? (converted / total) * 100 : 0;

  return {
    total,
    pending,
    converted,
    archived,
    conversionRate: Math.round(conversionRate),
  };
}

export async function getRecentInquiries(
  businessId: string,
  limit: number = 5
): Promise<FormInquiry[]> {
  const { data, error } = await supabase
    .from('form_inquiries')
    .select(`
      *,
      saved_requests!left(confirmation_code)
    `)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('is_test', false)
    .order('submission_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent inquiries:', error);
    return [];
  }

  const inquiries = (data || []).map((item: any) => ({
    ...item,
    confirmation_code: item.saved_requests?.[0]?.confirmation_code || null,
    saved_requests: undefined,
  }));

  return inquiries as FormInquiry[];
}
