import { supabase } from '../lib/supabase';

export type VerificationMethod = 'email';

export type StartLinkStatus = 'token_created' | 'no_match' | 'ambiguous';
export type ConsumeLinkStatus = 'linked' | 'invalid_token' | 'already_linked';
export type GmailAutoLinkStatus = 'linked' | 'not_gmail' | 'no_match' | 'ambiguous' | 'already_linked';
export type AutoCreateStatus = 'created' | 'already_exists' | 'linked_existing' | 'missing_email' | 'no_organization';

export interface StartLinkResult {
  status: StartLinkStatus;
  token: string | null;
  deliveryTarget: string | null;
  expiresAt: string | null;
  customerId: string | null;
}

export interface ConsumeLinkResult {
  status: ConsumeLinkStatus;
  customerId: string | null;
  linkedJobs: number;
  linkedInvoices: number;
}

export interface GmailAutoLinkResult {
  status: GmailAutoLinkStatus;
  customerId: string | null;
  linkedJobs: number;
  linkedInvoices: number;
}

export interface AutoCreateResult {
  status: AutoCreateStatus;
  customerId: string | null;
}

const getUserAgent = () => (typeof navigator !== 'undefined' ? navigator.userAgent : null);

export const portalAccountLinkingService = {
  async startLinkRequest(email: string, _verificationMethod: VerificationMethod): Promise<StartLinkResult> {
    // The one-time link code is created and mailed entirely on the server. It is
    // never returned here, so the person asking to link a record must be able to
    // read the mailbox already on file for it.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error('You need to be signed in to link your account.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-portal-link-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, verification_method: 'email', user_agent: getUserAgent() }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.success) {
      throw new Error('Failed to create account-link verification request.');
    }

    return {
      status: (data.status ?? 'no_match') as StartLinkStatus,
      token: null,
      deliveryTarget: null,
      expiresAt: null,
      customerId: null,
    };
  },

  async consumeLinkToken(token: string): Promise<ConsumeLinkResult> {
    const { data, error } = await supabase.rpc('consume_portal_account_link_token', {
      p_token: token,
      p_request_user_agent: getUserAgent(),
    });

    if (error) {
      throw new Error(error.message || 'Failed to validate account-link token.');
    }

    const row = Array.isArray(data) ? data[0] : null;

    return {
      status: (row?.status ?? 'invalid_token') as ConsumeLinkStatus,
      customerId: row?.customer_id ?? null,
      linkedJobs: row?.linked_jobs ?? 0,
      linkedInvoices: row?.linked_invoices ?? 0,
    };
  },

  async autoLinkGmailAccount(email: string): Promise<GmailAutoLinkResult> {
    const { data, error } = await supabase.rpc('auto_link_gmail_portal_account', {
      p_email: email,
      p_request_user_agent: getUserAgent(),
    });

    if (error) {
      throw new Error(error.message || 'Failed to auto-link Gmail account.');
    }

    const row = Array.isArray(data) ? data[0] : null;

    return {
      status: (row?.status ?? 'no_match') as GmailAutoLinkStatus,
      customerId: row?.customer_id ?? null,
      linkedJobs: row?.linked_jobs ?? 0,
      linkedInvoices: row?.linked_invoices ?? 0,
    };
  },

  async autoCreatePortalCustomer(email: string, fullName: string | null): Promise<AutoCreateResult> {
    const { data, error } = await supabase.rpc('auto_create_portal_customer', {
      p_email: email,
      p_full_name: fullName,
      p_request_user_agent: getUserAgent(),
    });

    if (error) {
      throw new Error(error.message || 'Failed to create portal account.');
    }

    const row = Array.isArray(data) ? data[0] : null;

    return {
      status: (row?.status ?? 'missing_email') as AutoCreateStatus,
      customerId: row?.customer_id ?? null,
    };
  },
};
