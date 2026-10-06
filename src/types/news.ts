/**
 * flat_pack, furniture_assembly — news stories.
 * deals — a current sale at a furniture store in or near Spring Hill, TN.
 *
 * Adding one means three changes: the `topic` check constraint on
 * `news_items`, this type, and `NEWS_TOPIC_LABELS`.
 */
export type NewsTopic = 'flat_pack' | 'furniture_assembly' | 'deals';

/**
 * draft     — saved by the daily news check, waiting for review. Never public.
 * published — approved; the only status anonymous visitors can read (RLS).
 * rejected  — reviewed and turned down. Kept so the daily check does not save
 *             the same story again.
 */
export type NewsStatus = 'draft' | 'published' | 'rejected';

export interface NewsItem {
  id: string;
  organization_id: string;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  topic: NewsTopic;
  /** Date the source published the story (YYYY-MM-DD). Null when unconfirmed. */
  source_published_on: string | null;
  status: NewsStatus;
  /** Set by the database the first time the item is published. */
  published_at: string | null;
  /** Admin's toggle: post to the Facebook Page when the draft is approved. */
  post_to_facebook: boolean;
  facebook_post_id: string | null;
  facebook_posted_at: string | null;
  facebook_post_error: string | null;
  created_at: string;
  updated_at: string;
}

/** The fields an admin can change before or after approving an item. */
export interface NewsItemEdits {
  title: string;
  summary: string;
  topic: NewsTopic;
}
