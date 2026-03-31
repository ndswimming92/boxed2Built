import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface HeroImage {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  focusX: number;
  focusY: number;
}

const HERO_IMAGE_CACHE_KEY = 'boxed2built_hero_image';
const HERO_IMAGE_CACHE_TTL_MS = 10 * 60 * 1000;

function getCachedImage(): HeroImage | null {
  try {
    const raw = sessionStorage.getItem(HERO_IMAGE_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > HERO_IMAGE_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedImage(data: HeroImage) {
  try {
    sessionStorage.setItem(HERO_IMAGE_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

export function useHeroImage() {
  const [image, setImage] = useState<HeroImage | null>(getCachedImage);
  const [loading, setLoading] = useState(!getCachedImage());

  useEffect(() => {
    if (image) return;

    let cancelled = false;

    async function fetchImage() {
      try {
        const { data, error } = await supabase
          .from('gallery_items')
          .select('src, alt, title, width, height, focus_x, focus_y')
          .eq('is_active', true)
          .eq('type', 'image')
          .eq('category', 'completed-work')
          .order('display_order', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error || !data || cancelled) return;

        const heroImage: HeroImage = {
          src: data.src,
          alt: data.alt || data.title || 'Completed furniture assembly by Boxed2Built',
          title: data.title,
          width: data.width || 810,
          height: data.height || 1080,
          focusX: parseFloat(data.focus_x) || 50,
          focusY: parseFloat(data.focus_y) || 50,
        };

        setCachedImage(heroImage);
        if (!cancelled) setImage(heroImage);
      } catch {
        // fail silently — hero still works without the image
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchImage();
    return () => { cancelled = true; };
  }, [image]);

  return { image, loading };
}
