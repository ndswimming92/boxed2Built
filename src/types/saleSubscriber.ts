/** active — gets the daily sales email. unsubscribed — opted out; kept so the admin can see it. */
export type SaleSubscriberStatus = 'active' | 'unsubscribed';

export interface SaleSubscriber {
  id: string;
  name: string;
  email: string;
  status: SaleSubscriberStatus;
  subscribed_at: string;
  unsubscribed_at: string | null;
  /** Approximate, from the IP address at sign-up (the IP itself is not kept). Null when it could not be placed. */
  city: string | null;
  region: string | null;
  /** US state abbreviation for US sign-ups, e.g. 'TN'. */
  region_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** One email the daily send attempted for a subscriber. */
export interface SaleDigestLogEntry {
  id: string;
  subscriber_id: string;
  sent_at: string;
  status: 'sent' | 'failed';
  subject: string;
  sale_count: number;
  sales: Array<{ title: string; store_name: string | null }>;
}
