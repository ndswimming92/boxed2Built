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

export interface CheckSocialPostStatusResult {
  checked: number;
  facebook_removed: string[];
  instagram_removed: string[];
}

export async function checkSocialPostStatus(galleryItemIds?: string[]): Promise<CheckSocialPostStatusResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/check-social-post-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(galleryItemIds ? { gallery_item_ids: galleryItemIds } : {}),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to check social post status');
  return body as CheckSocialPostStatusResult;
}

export type YoutubePrivacyStatus = 'private' | 'unlisted' | 'public';

export interface StartYoutubeUploadParams {
  title: string;
  description: string;
  privacyStatus: YoutubePrivacyStatus;
  contentType: string;
  contentLength: number;
}

async function startYoutubeUploadSession(params: StartYoutubeUploadParams): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/youtube-upload-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      title: params.title,
      description: params.description,
      privacy_status: params.privacyStatus,
      content_type: params.contentType,
      content_length: params.contentLength,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to start the YouTube upload');
  return body.session_uri as string;
}

export interface YoutubeUploadResult {
  videoId: string;
  videoUrl: string;
}

export function uploadVideoToYoutube(
  file: File,
  params: Omit<StartYoutubeUploadParams, 'contentType' | 'contentLength'>,
  onProgress?: (percent: number) => void,
): Promise<YoutubeUploadResult> {
  return startYoutubeUploadSession({
    ...params,
    contentType: file.type || 'video/mp4',
    contentLength: file.size,
  }).then(
    (sessionUri) =>
      new Promise<YoutubeUploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sessionUri, true);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

        xhr.upload.onprogress = (event) => {
          if (onProgress && event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const body = JSON.parse(xhr.responseText);
              const videoId = body.id as string;
              resolve({ videoId, videoUrl: `https://www.youtube.com/watch?v=${videoId}` });
            } catch {
              reject(new Error('YouTube returned an unexpected response.'));
            }
          } else {
            reject(new Error(`YouTube upload failed (status ${xhr.status}).`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error while uploading to YouTube.'));

        xhr.send(file);
      }),
  );
}
