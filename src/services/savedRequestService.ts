import { supabase, SavedRequest } from '../lib/supabase';
import { generateConfirmationCode } from '../utils/confirmationCode';

export interface CreateSavedRequestData {
  business_id: string;
  inquiry_id?: string;
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
}

export async function createSavedRequest(data: CreateSavedRequestData): Promise<SavedRequest> {
  let confirmationCode = generateConfirmationCode();
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 5;

  while (!isUnique && attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('saved_requests')
      .select('confirmation_code')
      .eq('confirmation_code', confirmationCode)
      .maybeSingle();

    if (!existing) {
      isUnique = true;
    } else {
      confirmationCode = generateConfirmationCode();
      attempts++;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique confirmation code');
  }

  const { data: savedRequest, error } = await supabase
    .from('saved_requests')
    .insert({
      business_id: data.business_id,
      inquiry_id: data.inquiry_id || null,
      confirmation_code: confirmationCode,
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
      submission_date: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating saved request:', error);
    throw new Error(`Failed to create saved request: ${error.message}`);
  }

  return savedRequest as SavedRequest;
}

export async function getSavedRequestByCode(
  email: string,
  confirmationCode: string
): Promise<SavedRequest | null> {
  const { data, error } = await supabase
    .from('saved_requests')
    .select('*')
    .eq('client_email', email)
    .eq('confirmation_code', confirmationCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching saved request:', error);
    throw new Error(`Failed to fetch saved request: ${error.message}`);
  }

  if (data) {
    await trackRequestAccess(email, confirmationCode);
  }

  return data as SavedRequest | null;
}

async function trackRequestAccess(
  email: string,
  confirmationCode: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('track_saved_request_access', {
      p_email: email,
      p_confirmation_code: confirmationCode,
    });

    if (error) {
      console.error('Error tracking request access:', error);
    }
  } catch (error) {
    console.error('Failed to track request access:', error);
  }
}

export async function getSavedRequestsByEmail(email: string): Promise<SavedRequest[]> {
  const { data, error } = await supabase
    .from('saved_requests')
    .select('*')
    .eq('client_email', email)
    .eq('is_active', true)
    .order('submission_date', { ascending: false });

  if (error) {
    console.error('Error fetching saved requests:', error);
    throw new Error(`Failed to fetch saved requests: ${error.message}`);
  }

  return (data || []) as SavedRequest[];
}

export async function getAllSavedRequests(businessId: string): Promise<SavedRequest[]> {
  const { data, error } = await supabase
    .from('saved_requests')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('submission_date', { ascending: false });

  if (error) {
    console.error('Error fetching all saved requests:', error);
    throw new Error(`Failed to fetch saved requests: ${error.message}`);
  }

  return (data || []) as SavedRequest[];
}

export async function archiveSavedRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_requests')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error archiving saved request:', error);
    throw new Error(`Failed to archive saved request: ${error.message}`);
  }
}

export async function getSavedRequestStats(businessId: string) {
  const { data, error } = await supabase
    .from('saved_requests')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching saved request stats:', error);
    return {
      total: 0,
      accessed: 0,
      totalAccessCount: 0,
      averageAccessCount: 0,
    };
  }

  const requests = data || [];
  const total = requests.length;
  const accessed = requests.filter((r) => r.access_count > 0).length;
  const totalAccessCount = requests.reduce((sum, r) => sum + r.access_count, 0);
  const averageAccessCount = total > 0 ? Math.round(totalAccessCount / total * 10) / 10 : 0;

  return {
    total,
    accessed,
    totalAccessCount,
    averageAccessCount,
  };
}
