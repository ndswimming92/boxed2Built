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

interface SendPortalVerificationEmailPayload {
  /** One-time link token. The server resolves the recipient and builds the URL. */
  token: string;
}

const getUserAgent = () => (typeof navigator !== 'undefined' ? navigator.userAgent : null);

export const portalAccountLinkingService = {
  async startLinkRequest(email: string, verificationMethod: VerificationMethod): Promise<StartLinkResult> {
    const { data, error } = await supabase.rpc('create_portal_account_link_token', {
      p_email: email,
      p_verification_method: verificationMethod,
      p_request_user_agent: getUserAgent(),
    });

    if (error) {
      throw new Error(error.message || 'Failed to create account-link verification request.');
    }

    const row = Array.isArray(data) ? data[0] : null;

    return {
      status: (row?.status ?? 'no_match') as StartLinkStatus,
      token: row?.token ?? null,
      deliveryTarget: row?.delivery_target ?? null,
      expiresAt: row?.expires_at ?? null,
      customerId: row?.customer_id ?? null,
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

  async sendVerificationEmail(payload: SendPortalVerificationEmailPayload): Promise<void> {
    // The verification email always goes to the signed-in account's own
    // address, which the server derives from this token. Sending the anon key
    // here would let anyone mail an arbitrary link from the business address.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error('You need to be signed in to request a verification email.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-portal-link-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: payload.token }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      const message = typeof data?.error === 'string'
        ? data.error
        : 'Failed to send verification email.';
      throw new Error(message);
    }
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
