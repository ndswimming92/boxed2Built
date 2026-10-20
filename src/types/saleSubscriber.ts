/** active — gets the daily sales email. unsubscribed — opted out; kept so the admin can see it. */
export type SaleSubscriberStatus = 'active' | 'unsubscribed';

export interface SaleSubscriber {
  id: string;
  name: string;
  email: string;
  status: SaleSubscriberStatus;
  subscribed_at: string;
  unsubscribed_at: string | null;
}
