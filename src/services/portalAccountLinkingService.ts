import { supabase } from '../lib/supabase';

export type VerificationMethod = 'email' | 'sms';

export type StartLinkStatus = 'token_created' | 'no_match' | 'ambiguous';
export type ConsumeLinkStatus = 'linked' | 'invalid_token' | 'already_linked';

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
};
