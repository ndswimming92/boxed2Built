const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const MAX_CAPTION_LENGTH = 2000;
const REQUIRED_HASHTAG = '#Boxed2Built';

export interface FacebookTokens {
  page_access_token: string;
  page_id: string;
  page_name: string;
  ig_user_id: string | null;
  ig_username: string | null;
}

export interface PlatformResult {
  success: boolean;
  post_id?: string;
  error?: string;
}

export function buildCaption(title: string, description?: string | null, hashtags?: string[] | null): string {
  let caption = description ? `${title}\n\n${description}` : title;

  const tags = (hashtags || []).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  if (!tags.some((tag) => tag.toLowerCase() === REQUIRED_HASHTAG.toLowerCase())) {
    tags.push(REQUIRED_HASHTAG);
  }
  caption += `\n\n${tags.join(' ')}`;

  return caption.slice(0, MAX_CAPTION_LENGTH);
}

export async function postToFacebook(
  tokens: FacebookTokens,
  imageUrl: string,
  caption: string,
  altText?: string | null
): Promise<PlatformResult> {
  try {
    const params: Record<string, string> = {
      url: imageUrl,
      caption,
      access_token: tokens.page_access_token,
    };
    if (altText) params.alt_text_custom = altText;

    const res = await fetch(`${GRAPH_URL}/${tokens.page_id}/photos`, {
      method: 'POST',
      body: new URLSearchParams(params),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Facebook rejected the post');
    return { success: true, post_id: body.post_id ?? body.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Facebook error' };
  }
}

async function waitForContainerReady(creationId: string, accessToken: string): Promise<void> {
  const maxAttempts = 15;
  const delayMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusRes = await fetch(
      `${GRAPH_URL}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
    );
    const statusBody = await statusRes.json();
    if (!statusRes.ok) throw new Error(statusBody?.error?.message || 'Failed to check Instagram media container status');

    if (statusBody.status_code === 'FINISHED') return;
    if (statusBody.status_code === 'ERROR' || statusBody.status_code === 'EXPIRED') {
      throw new Error(`Instagram media container failed to process (${statusBody.status_code})`);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('Instagram media container took too long to process. Try publishing again.');
}

export interface PostRemovalCheck {
  removed: boolean;
  reason?: string;
}

// Facebook returns error code 100 ("Object does not exist...") for posts/media
// that were deleted or taken down (e.g. by its spam/policy enforcement) after
// publishing. Other error codes (rate limits, transient permission hiccups)
// are left alone since they don't reliably mean the post is gone.
//
// Deliberately no `fields` param: requesting `fields=id` alone (or hitting
// `/{id}/comments` as its own edge) makes the Graph API falsely report some
// live, commentable posts as nonexistent. Falling back to the default field
// set avoids that false positive and still 400s on genuinely deleted posts.
export async function checkPostRemoved(objectId: string, accessToken: string): Promise<PostRemovalCheck> {
  const url = new URL(`${GRAPH_URL}/${objectId}`);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  if (res.ok) return { removed: false };

  const body = await res.json().catch(() => ({}));
  const code = body?.error?.code;
  const message = body?.error?.message as string | undefined;
  if (code === 100) {
    return { removed: true, reason: message || 'Facebook reports this post no longer exists.' };
  }
  return { removed: false };
}

export async function postToInstagram(
  tokens: FacebookTokens,
  imageUrl: string,
  caption: string,
  altText?: string | null
): Promise<PlatformResult> {
  if (!tokens.ig_user_id) {
    return { success: false, error: 'No Instagram Business account is linked to the connected Facebook Page.' };
  }
  try {
    const containerParams: Record<string, string> = {
      image_url: imageUrl,
      caption,
      access_token: tokens.page_access_token,
    };
    if (altText) containerParams.alt_text = altText;

    const createRes = await fetch(`${GRAPH_URL}/${tokens.ig_user_id}/media`, {
      method: 'POST',
      body: new URLSearchParams(containerParams),
    });
    const createBody = await createRes.json();
    if (!createRes.ok) throw new Error(createBody?.error?.message || 'Instagram rejected the media container');
    const creationId = createBody.id as string;

    await waitForContainerReady(creationId, tokens.page_access_token);

    const publishRes = await fetch(`${GRAPH_URL}/${tokens.ig_user_id}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: tokens.page_access_token,
      }),
    });
    const publishBody = await publishRes.json();
    if (!publishRes.ok) throw new Error(publishBody?.error?.message || 'Instagram rejected publishing the post');
    return { success: true, post_id: publishBody.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Instagram error' };
  }
}

/**
 * A plain text post on the Page's own feed, for things with no photo — a
 * coupon announcement, say. Instagram has no equivalent: its Content
 * Publishing API requires media on every post, so text-only announcements are
 * a Facebook-only path by construction.
 */
export async function postTextToFacebook(
  tokens: FacebookTokens,
  message: string,
  link?: string | null,
): Promise<PlatformResult> {
  try {
    const trimmed = message.trim();
    if (!trimmed) return { success: false, error: 'Nothing to post — the message is empty.' };

    const params: Record<string, string> = {
      message: trimmed.slice(0, MAX_CAPTION_LENGTH),
      access_token: tokens.page_access_token,
    };
    if (link) params.link = link;

    const res = await fetch(`${GRAPH_URL}/${tokens.page_id}/feed`, {
      method: 'POST',
      body: new URLSearchParams(params),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Facebook rejected the post');
    return { success: true, post_id: body.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Facebook error' };
  }
}
