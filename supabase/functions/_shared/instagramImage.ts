import {
  AlphaOption,
  CompositeOperator,
  Gravity,
  ImageMagick,
  initializeImageMagick,
  MagickColor,
  MagickFormat,
  MagickGeometry,
} from 'npm:@imagemagick/magick-wasm@0.0.30';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';
import type { PlatformResult } from './socialPublish.ts';

/*
 * Instagram's Content Publishing API is far pickier than Facebook's:
 *
 *   - the file must be a JPEG (our gallery uploads are WebP, which it rejects
 *     outright with "Only photo or video can be accepted as media type")
 *   - the aspect ratio must sit between 4:5 (0.8) and 1.91:1, so anything
 *     panoramic — a desktop screenshot, for instance — is refused with
 *     "The aspect ratio is not supported"
 *   - the file must be 8MB or smaller
 *
 * Rather than let the post fail, we render an Instagram-safe JPEG derivative of
 * the gallery image and hand Instagram that instead. Out-of-range photos are
 * letterboxed onto a blurred copy of themselves so nothing is ever cropped away.
 * Facebook keeps posting the original file.
 */

export const INSTAGRAM_MIN_ASPECT = 0.8;
export const INSTAGRAM_MAX_ASPECT = 1.91;

// When we have to pad, aim just inside the limits so that rounding to whole
// pixels can never land back on the wrong side of them.
const PAD_TO_MIN_ASPECT = 0.81;
const PAD_TO_MAX_ASPECT = 1.9;

const MAX_EDGE = 1440;
const MIN_EDGE = 320;
const MAX_BYTES = 8 * 1024 * 1024;
const JPEG_QUALITY = 88;

// The blurred backdrop is built by shrinking the photo to a few pixels, blurring
// that, then stretching it back over the canvas — far cheaper than blurring at
// full size, and the result is the same soft wash of colour.
const BACKDROP_SAMPLE_EDGE = 24;

const BUCKET = 'gallery-images';
const DERIVATIVE_PREFIX = 'instagram-ready';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'unknown';

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
}

export interface InstagramImagePlan {
  /** True when the source can be handed to Instagram untouched. */
  compliant: boolean;
  /** Human-readable list of everything Instagram would have objected to. */
  reasons: string[];
  /** Final canvas Instagram receives. */
  canvasWidth: number;
  canvasHeight: number;
  /** Size the photo itself is drawn at, centred on the canvas. */
  photoWidth: number;
  photoHeight: number;
  /** True when the canvas is larger than the photo, i.e. bars are added. */
  padded: boolean;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function readJpegInfo(bytes: Uint8Array): ImageInfo | null {
  // Walk the marker segments looking for a start-of-frame, which is the only
  // place the real dimensions live.
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        format: 'jpeg',
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }

    // Padding bytes and standalone markers carry no length field.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const segmentLength = readUint16BE(bytes, offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebpInfo(bytes: Uint8Array): ImageInfo | null {
  if (matchesAscii(bytes, 12, 'VP8X')) {
    return {
      format: 'webp',
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }
  if (matchesAscii(bytes, 12, 'VP8L')) {
    // 14 bits of width then 14 bits of height, packed little-endian after the
    // 0x2F signature byte.
    const packed =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      format: 'webp',
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }
  if (matchesAscii(bytes, 12, 'VP8 ')) {
    return {
      format: 'webp',
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff,
    };
  }
  return null;
}

/**
 * Reads the format and pixel dimensions straight out of the file header, so we
 * can decide whether a re-render is needed without decoding the whole image.
 * Returns null when the bytes aren't an image format we recognise.
 */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 32) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return readJpegInfo(bytes);
  }
  if (
    bytes[0] === 0x89 &&
    matchesAscii(bytes, 1, 'PNG') &&
    matchesAscii(bytes, 12, 'IHDR')
  ) {
    return {
      format: 'png',
      width: readUint32BE(bytes, 16),
      height: readUint32BE(bytes, 20),
    };
  }
  if (matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WEBP')) {
    return readWebpInfo(bytes);
  }
  if (matchesAscii(bytes, 0, 'GIF8')) {
    return {
      format: 'gif',
      width: readUint16LE(bytes, 6),
      height: readUint16LE(bytes, 8),
    };
  }
  return null;
}

/**
 * Works out what Instagram would reject about an image and what canvas we need
 * to render instead. Pure maths — no decoding — so it is cheap to call and easy
 * to reason about.
 */
export function planInstagramImage(info: ImageInfo, byteLength: number): InstagramImagePlan {
  const reasons: string[] = [];
  const aspect = info.width / info.height;

  if (info.format !== 'jpeg') {
    reasons.push(`Instagram only accepts JPEG (this image is ${info.format.toUpperCase()})`);
  }
  if (aspect > INSTAGRAM_MAX_ASPECT) {
    reasons.push(`too wide for Instagram (${aspect.toFixed(2)}:1, limit is 1.91:1)`);
  } else if (aspect < INSTAGRAM_MIN_ASPECT) {
    reasons.push(`too tall for Instagram (${aspect.toFixed(2)}:1, limit is 4:5)`);
  }
  if (info.width > MAX_EDGE || info.height > MAX_EDGE) {
    reasons.push(`larger than Instagram renders (${info.width}x${info.height})`);
  }
  if (info.width < MIN_EDGE) {
    reasons.push(`narrower than Instagram's ${MIN_EDGE}px minimum`);
  }
  if (byteLength > MAX_BYTES) {
    reasons.push('over Instagram\'s 8MB limit');
  }

  // Start from the photo's own size and grow one edge until the canvas ratio is
  // inside Instagram's window. Growing (rather than cropping) is what keeps the
  // whole photo visible.
  let canvasWidth = info.width;
  let canvasHeight = info.height;
  if (aspect > INSTAGRAM_MAX_ASPECT) {
    canvasHeight = info.width / PAD_TO_MAX_ASPECT;
  } else if (aspect < INSTAGRAM_MIN_ASPECT) {
    canvasWidth = info.height * PAD_TO_MIN_ASPECT;
  }

  let scale = Math.min(MAX_EDGE / canvasWidth, MAX_EDGE / canvasHeight, 1);
  if (canvasWidth * scale < MIN_EDGE) {
    scale = MIN_EDGE / canvasWidth;
  }

  canvasWidth = Math.round(canvasWidth * scale);
  canvasHeight = Math.round(canvasHeight * scale);

  // Rounding to whole pixels can nudge the ratio back over a limit; pull it in.
  if (canvasWidth / canvasHeight > INSTAGRAM_MAX_ASPECT) {
    canvasHeight = Math.ceil(canvasWidth / PAD_TO_MAX_ASPECT);
  } else if (canvasWidth / canvasHeight < INSTAGRAM_MIN_ASPECT) {
    canvasWidth = Math.ceil(canvasHeight * PAD_TO_MIN_ASPECT);
  }

  const fit = Math.min(canvasWidth / info.width, canvasHeight / info.height);
  const photoWidth = Math.min(canvasWidth, Math.round(info.width * fit));
  const photoHeight = Math.min(canvasHeight, Math.round(info.height * fit));

  return {
    compliant: reasons.length === 0,
    reasons,
    canvasWidth,
    canvasHeight,
    photoWidth,
    photoHeight,
    padded: photoWidth < canvasWidth || photoHeight < canvasHeight,
  };
}

let magickReady: Promise<void> | null = null;

function ensureMagick(): Promise<void> {
  if (!magickReady) {
    magickReady = (async () => {
      const wasmBytes = await Deno.readFile(
        new URL('magick.wasm', import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.30')),
      );
      await initializeImageMagick(wasmBytes);
    })().catch((error) => {
      // Don't cache a failed init — the next publish should get a fresh attempt.
      magickReady = null;
      throw error;
    });
  }
  return magickReady;
}

/**
 * Renders the plan: the photo scaled to fit, centred on a canvas Instagram will
 * accept, encoded as JPEG. Padding is filled with a blurred copy of the photo.
 */
export async function renderInstagramJpeg(
  bytes: Uint8Array,
  plan: InstagramImagePlan,
): Promise<Uint8Array> {
  await ensureMagick();

  return ImageMagick.read(bytes, (photo) => {
    photo.resize(plan.photoWidth, plan.photoHeight);
    photo.backgroundColor = new MagickColor('#ffffff');
    // JPEG has no alpha channel; flatten transparency onto white first so it
    // doesn't come out black.
    photo.alpha(AlphaOption.Remove);

    if (!plan.padded) {
      photo.quality = JPEG_QUALITY;
      return photo.write(MagickFormat.Jpeg, (data) => new Uint8Array(data));
    }

    return photo.clone((backdrop) => {
      const sample = new MagickGeometry(BACKDROP_SAMPLE_EDGE, BACKDROP_SAMPLE_EDGE);
      sample.ignoreAspectRatio = true;
      backdrop.resize(sample);
      backdrop.blur(0, 4);

      const canvas = new MagickGeometry(plan.canvasWidth, plan.canvasHeight);
      canvas.ignoreAspectRatio = true;
      backdrop.resize(canvas);

      backdrop.compositeGravity(photo, Gravity.Center, CompositeOperator.Over);
      backdrop.quality = JPEG_QUALITY;
      return backdrop.write(MagickFormat.Jpeg, (data) => new Uint8Array(data));
    });
  });
}

export function instagramDerivativePath(galleryItemId: string): string {
  return `${DERIVATIVE_PREFIX}/${galleryItemId}.jpg`;
}

async function shortHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 4))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export interface PreparedInstagramImage {
  /** URL to hand to the Instagram API. */
  url: string;
  /** True when `url` points at a freshly rendered derivative. */
  reformatted: boolean;
  /** Set when reformatting was needed but failed, in which case `url` is the original. */
  error?: string;
  /** Short explanation of what was changed, for logs and admin messages. */
  note?: string;
}

/**
 * Returns a URL Instagram will accept for a gallery image, rendering and
 * uploading a compliant JPEG derivative when the original wouldn't pass.
 *
 * Never throws: if anything goes wrong we fall back to the original URL and let
 * Instagram report the problem, so this can't make publishing worse than it was.
 */
export async function prepareInstagramImage(
  admin: SupabaseClient,
  galleryItemId: string,
  sourceUrl: string,
): Promise<PreparedInstagramImage> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      return { url: sourceUrl, reformatted: false, error: `Could not read the gallery image (HTTP ${res.status}).` };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());

    const info = readImageInfo(bytes);
    if (!info || !info.width || !info.height) {
      return { url: sourceUrl, reformatted: false, error: 'Could not read the image dimensions.' };
    }

    const plan = planInstagramImage(info, bytes.length);
    if (plan.compliant) {
      return { url: sourceUrl, reformatted: false };
    }

    const jpeg = await renderInstagramJpeg(bytes, plan);
    const path = instagramDerivativePath(galleryItemId);

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, jpeg, {
      contentType: 'image/jpeg',
      cacheControl: '60',
      upsert: true,
    });
    if (uploadError) {
      return { url: sourceUrl, reformatted: false, error: `Could not save the Instagram-ready image: ${uploadError.message}` };
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    // The derivative is overwritten in place on every publish, so bust the CDN
    // cache with a content hash — otherwise Instagram may fetch a stale version.
    const url = `${urlData.publicUrl}?v=${await shortHash(jpeg)}`;

    return {
      url,
      reformatted: true,
      note: `Reformatted for Instagram: ${info.width}x${info.height} ${info.format.toUpperCase()} → ${plan.canvasWidth}x${plan.canvasHeight} JPEG (${plan.reasons.join('; ')})`,
    };
  } catch (error) {
    return {
      url: sourceUrl,
      reformatted: false,
      error: error instanceof Error ? error.message : 'Unknown error while reformatting for Instagram',
    };
  }
}

/**
 * When we couldn't produce a compliant image and Instagram then refused the
 * original, lead with the reformatting problem — on its own, Instagram's message
 * ("Only photo or video can be accepted as media type") explains very little.
 */
export function annotateInstagramError(
  prepared: PreparedInstagramImage,
  result: PlatformResult,
): PlatformResult {
  if (result.success || !prepared.error) return result;
  return { ...result, error: `${prepared.error} ${result.error ?? ''}`.trim() };
}
