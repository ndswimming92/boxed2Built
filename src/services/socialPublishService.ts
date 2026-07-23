import { supabase } from '../lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface PlatformPublishResult {
  success: boolean;
  post_id?: string;
  error?: string;
}

export interface PublishGalleryPhotoResult {
  facebook: PlatformPublishResult;
  instagram: PlatformPublishResult;
}

export async function publishGalleryPhoto(galleryItemId: string): Promise<PublishGalleryPhotoResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/publish-gallery-photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ gallery_item_id: galleryItemId }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to publish to social media');
  return body as PublishGalleryPhotoResult;
}
