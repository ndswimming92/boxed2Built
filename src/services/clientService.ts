import { supabase } from '../lib/supabase';

export type ClientStatus = 'lead' | 'active' | 'repeat' | 'dormant';
export type ClientValueTier = 'standard' | 'high_value' | 'vip';

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  client_status: ClientStatus;
  client_value_tier: ClientValueTier;
  marketing_email_opt_in: boolean;
  opt_in_date: string;
  opt_out_date: string | null;
  last_campaign_date: string | null;
  first_contact_date: string | null;
  last_contact_date: string | null;
  last_job_date: string | null;
  total_revenue: number;
  job_count: number;
  average_job_value: number;
  source: string | null;
  tags: string[];
  preferences_token: string;
  is_test: boolean;
  referral_code: string | null;
  referred_by_client_id: string | null;
  referral_credit_balance: number;
  referral_credit_used: number;
  referral_scan_count: number;
  referral_last_scanned_at: string | null;
  last_followup_email_sent_at: string | null;
  last_invoice_email_sent_at: string | null;
  last_quote_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNote {
  id: string;
  organization_id: string;
  client_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientHistory {
  inquiries: any[];
  jobs: any[];
  invoices: any[];
}

export interface ClientSegmentStats {
  total_clients: number;
  repeat_customers: number;
  high_value_clients: number;
  dormant_clients: number;
  new_leads: number;
  total_revenue: number;
  average_client_value: number;
}

export interface ClientExportOptions {
  includeEmail: boolean;
  includePhone: boolean;
  includeName: boolean;
  includeAddress: boolean;
  includeRevenue: boolean;
  includeJobCount: boolean;
  includeStatus: boolean;
  includeValueTier: boolean;
}

// Get all clients for the organization (excludes test accounts)
export async function getAllClients(organizationId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_test', false)
    .order('last_contact_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Get all clients including test accounts (for admin management)
export async function getAllClientsIncludingTest(organizationId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .order('last_contact_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Get client by ID with full details
export async function getClientById(clientId: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Get client history (inquiries, jobs, invoices)
export async function getClientHistory(clientId: string, clientEmail: string | null): Promise<ClientHistory> {
  const history: ClientHistory = {
    inquiries: [],
    jobs: [],
    invoices: []
  };

  let query = supabase
    .from('form_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  } else if (clientEmail) {
    query = query.ilike('client_email', clientEmail);
  }

  const { data: inquiries } = await query;
  history.inquiries = inquiries || [];

  // Get jobs by client_id
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  history.jobs = jobs || [];

  // Get invoices by client_id
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  history.invoices = invoices || [];

  return history;
}

// Get clients by segment (excludes test accounts)
export async function getClientSegment(
  organizationId: string,
  segment: 'all' | 'repeat' | 'high_value' | 'dormant' | 'leads'
): Promise<Client[]> {
  let query = supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_test', false);

  switch (segment) {
    case 'repeat':
      query = query.gte('job_count', 2);
      break;
    case 'high_value':
      query = query.in('client_value_tier', ['high_value', 'vip']);
      break;
    case 'dormant':
      query = query.eq('client_status', 'dormant');
      break;
    case 'leads':
      query = query.eq('client_status', 'lead');
      break;
  }

  const { data, error } = await query.order('last_contact_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Get segment statistics (excludes test accounts)
export async function getClientSegmentStats(organizationId: string): Promise<ClientSegmentStats> {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('client_status, client_value_tier, total_revenue, job_count')
    .eq('organization_id', organizationId)
    .eq('is_test', false);

  if (error) throw error;

  const stats: ClientSegmentStats = {
    total_clients: clients?.length || 0,
    repeat_customers: clients?.filter(c => c.job_count >= 2).length || 0,
    high_value_clients: clients?.filter(c => ['high_value', 'vip'].includes(c.client_value_tier)).length || 0,
    dormant_clients: clients?.filter(c => c.client_status === 'dormant').length || 0,
    new_leads: clients?.filter(c => c.client_status === 'lead').length || 0,
    total_revenue: clients?.reduce((sum, c) => sum + (parseFloat(c.total_revenue?.toString() || '0')), 0) || 0,
    average_client_value: 0
  };

  if (stats.total_clients > 0) {
    stats.average_client_value = stats.total_revenue / stats.total_clients;
  }

  return stats;
}

// Search clients (excludes test accounts)
export async function searchClients(organizationId: string, searchTerm: string): Promise<Client[]> {
  const term = `%${searchTerm}%`;

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_test', false)
    .or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},address.ilike.${term}`)
    .order('last_contact_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Get dormant clients (no activity in 90+ days)
export async function getDormantClients(organizationId: string, _daysThreshold: number = 90): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('client_status', 'dormant')
    .order('last_contact_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Get high-value clients
export async function getHighValueClients(organizationId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .in('client_value_tier', ['high_value', 'vip'])
    .order('total_revenue', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get repeat customers
export async function getRepeatCustomers(organizationId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('job_count', 2)
    .order('job_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Create new client
export async function createClient(client: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export interface NewClientInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  client_status?: ClientStatus;
  client_value_tier?: ClientValueTier;
  source?: string | null;
  tags?: string[];
  marketing_email_opt_in?: boolean;
  is_test?: boolean;
}

// Create a client from the admin portal. Rows created through an inquiry get a
// preferences token from the database function; admin-created rows need the same
// thing so the client can use the self-service preferences link later on. The
// referral code is assigned by a database trigger, so it is not set here.
export async function createClientRecord(
  organizationId: string,
  input: NewClientInput
): Promise<Client> {
  let preferencesToken: string | null = null;
  try {
    const { data, error } = await supabase.rpc('generate_preferences_token');
    if (error) throw error;
    preferencesToken = data ?? null;
  } catch (error) {
    // The token is only used for the client's self-service preferences link, so a
    // failure here shouldn't cost the admin the whole record. Saving without one
    // matches the pre-referral rows that are already in the table.
    console.error('Could not generate a preferences token for the new client:', error);
  }

  const now = new Date().toISOString();

  return createClient({
    organization_id: organizationId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    client_status: input.client_status ?? 'lead',
    client_value_tier: input.client_value_tier ?? 'standard',
    source: input.source ?? null,
    tags: input.tags ?? [],
    marketing_email_opt_in: input.marketing_email_opt_in ?? true,
    is_test: input.is_test ?? false,
    first_contact_date: now,
    last_contact_date: now,
    ...(preferencesToken ? { preferences_token: preferencesToken } : {}),
  });
}

// Update client
export async function updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update marketing preferences
export async function updateMarketingPreferences(
  clientId: string,
  emailOptIn: boolean
): Promise<void> {
  const updates: any = {
    marketing_email_opt_in: emailOptIn
  };

  if (!emailOptIn) {
    updates.opt_out_date = new Date().toISOString();
  }

  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId);

  if (error) throw error;
}

// Get clients for marketing (with opt-in filters)
export async function getClientsForMarketing(
  organizationId: string,
  segment?: 'all' | 'repeat' | 'high_value' | 'dormant'
): Promise<Client[]> {
  let query = supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('marketing_email_opt_in', true)
    .not('email', 'is', null);

  // Apply segment filter
  if (segment && segment !== 'all') {
    switch (segment) {
      case 'repeat':
        query = query.gte('job_count', 2);
        break;
      case 'high_value':
        query = query.in('client_value_tier', ['high_value', 'vip']);
        break;
      case 'dormant':
        query = query.eq('client_status', 'dormant');
        break;
    }
  }

  const { data, error } = await query.order('last_contact_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Export clients to CSV
export function exportClientsToCSV(clients: Client[], options: ClientExportOptions): string {
  const headers: string[] = [];

  if (options.includeName) headers.push('Name');
  if (options.includeEmail) headers.push('Email');
  if (options.includePhone) headers.push('Phone');
  if (options.includeAddress) headers.push('Address');
  if (options.includeStatus) headers.push('Status');
  if (options.includeValueTier) headers.push('Value Tier');
  if (options.includeJobCount) headers.push('Jobs');
  if (options.includeRevenue) headers.push('Total Revenue');

  const rows = clients.map(client => {
    const row: string[] = [];

    if (options.includeName) row.push(`"${client.name || ''}"`);
    if (options.includeEmail) row.push(`"${client.email || ''}"`);
    if (options.includePhone) row.push(`"${client.phone || ''}"`);
    if (options.includeAddress) row.push(`"${client.address || ''}"`);
    if (options.includeStatus) row.push(`"${client.client_status}"`);
    if (options.includeValueTier) row.push(`"${client.client_value_tier}"`);
    if (options.includeJobCount) row.push(client.job_count.toString());
    if (options.includeRevenue) row.push(client.total_revenue.toString());

    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// Download CSV file
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
}

// Get email list as comma-separated string
export function getEmailList(clients: Client[]): string {
  return clients
    .filter(c => c.email && c.marketing_email_opt_in)
    .map(c => c.email)
    .join(', ');
}

// Calculate client metrics manually (calls database function)
export async function calculateClientMetrics(clientId: string): Promise<void> {
  const { error } = await supabase.rpc('update_client_metrics', {
    client_id_input: clientId
  });

  if (error) throw error;
}

// Get or create client by email (using database function)
export async function getOrCreateClientByEmail(
  organizationId: string,
  email: string,
  name?: string,
  phone?: string,
  address?: string,
  source?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_client_by_email', {
    p_organization_id: organizationId,
    p_email: email,
    p_name: name || null,
    p_phone: phone || null,
    p_address: address || null,
    p_source: source || null
  });

  if (error) throw error;
  return data;
}

// Merge two clients: keeps one, discards the other, reassigns all related records
export async function mergeClients(keepClientId: string, discardClientId: string): Promise<Client> {
  const { data, error } = await supabase.rpc('merge_clients', {
    p_keep_client_id: keepClientId,
    p_discard_client_id: discardClientId,
  });

  if (error) throw error;
  return data;
}

// Get merge preview counts for a client
export async function getMergePreviewCounts(clientId: string): Promise<{
  jobs: number;
  invoices: number;
  inquiries: number;
  notes: number;
}> {
  const [jobsRes, invoicesRes, inquiriesRes, notesRes] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('form_inquiries').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('client_notes').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
  ]);

  return {
    jobs: jobsRes.count ?? 0,
    invoices: invoicesRes.count ?? 0,
    inquiries: inquiriesRes.count ?? 0,
    notes: notesRes.count ?? 0,
  };
}

// Delete client
export async function deleteClient(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);

  if (error) throw error;
}

// Client Notes functions

export async function getClientNotes(clientId: string): Promise<ClientNote[]> {
  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createClientNote(
  clientId: string,
  organizationId: string,
  note: string,
  createdBy: string
): Promise<ClientNote> {
  const { data, error } = await supabase
    .from('client_notes')
    .insert({
      client_id: clientId,
      organization_id: organizationId,
      note,
      created_by: createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClientNote(noteId: string, note: string): Promise<ClientNote> {
  const { data, error } = await supabase
    .from('client_notes')
    .update({ note })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteClientNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('client_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}

// Add tags to client
export async function addClientTags(clientId: string, tags: string[]): Promise<void> {
  const client = await getClientById(clientId);
  if (!client) throw new Error('Client not found');

  const existingTags = client.tags || [];
  const newTags = [...new Set([...existingTags, ...tags])];

  await updateClient(clientId, { tags: newTags });
}

// Remove tags from client
export async function removeClientTags(clientId: string, tagsToRemove: string[]): Promise<void> {
  const client = await getClientById(clientId);
  if (!client) throw new Error('Client not found');

  const existingTags = client.tags || [];
  const newTags = existingTags.filter(tag => !tagsToRemove.includes(tag));

  await updateClient(clientId, { tags: newTags });
}

// Update last campaign date
export async function updateLastCampaignDate(clientIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ last_campaign_date: new Date().toISOString() })
    .in('id', clientIds);

  if (error) throw error;
}

// Get clients who were referred by a specific client
export async function getReferredClients(referrerClientId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('referred_by_client_id', referrerClientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Look up a client by referral code
export async function getClientByReferralCode(referralCode: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('referral_code', referralCode.toUpperCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Add referral credit to a client
export async function addReferralCredit(clientId: string, amount: number): Promise<Client> {
  const client = await getClientById(clientId);
  if (!client) throw new Error('Client not found');

  const newBalance = parseFloat((client.referral_credit_balance + amount).toFixed(2));
  return updateClient(clientId, { referral_credit_balance: newBalance });
}

// Redeem referral credit (subtract from balance, add to used)
export async function redeemReferralCredit(clientId: string, amount: number): Promise<Client> {
  const client = await getClientById(clientId);
  if (!client) throw new Error('Client not found');

  if (amount > client.referral_credit_balance) {
    throw new Error('Insufficient referral credit balance');
  }

  const newBalance = parseFloat((client.referral_credit_balance - amount).toFixed(2));
  const newUsed = parseFloat((client.referral_credit_used + amount).toFixed(2));

  return updateClient(clientId, {
    referral_credit_balance: newBalance,
    referral_credit_used: newUsed,
  });
}

// Get referral stats for dashboard
export async function getReferralStats(organizationId: string): Promise<{
  totalCodes: number;
  totalReferrals: number;
  creditsIssuedAllTime: number;
  creditsRedeemedAllTime: number;
}> {
  const [
    { data: clientsData, error: clientsError },
    { count: referredInquiryCount, error: inquiriesError }
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('referral_code, referred_by_client_id, referral_credit_balance, referral_credit_used')
      .eq('organization_id', organizationId)
      .eq('is_test', false),
    supabase
      .from('form_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_test', false)
      .not('referral_code_used', 'is', null)
      .neq('referral_code_used', ''),
  ]);

  if (clientsError) throw clientsError;
  if (inquiriesError) throw inquiriesError;

  const clients = clientsData || [];
  const clientReferralCount = clients.filter(c => c.referred_by_client_id).length;

  return {
    totalCodes: clients.filter(c => c.referral_code).length,
    totalReferrals: Math.max(clientReferralCount, referredInquiryCount || 0),
    creditsIssuedAllTime: clients.reduce(
      (sum, c) => sum + (parseFloat(c.referral_credit_balance?.toString() || '0') + parseFloat(c.referral_credit_used?.toString() || '0')),
      0
    ),
    creditsRedeemedAllTime: clients.reduce(
      (sum, c) => sum + parseFloat(c.referral_credit_used?.toString() || '0'),
      0
    ),
  };
}
