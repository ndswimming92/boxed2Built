import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface HeroImage {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  focusX: number;
  focusY: number;
}

const HERO_IMAGES_CACHE_KEY = 'boxed2built_hero_images';
const HERO_IMAGES_CACHE_TTL_MS = 10 * 60 * 1000;
const HERO_IMAGE_IDS = [
  '5c800a31-11a7-48b5-8597-a6f52db27030',
  '263e84e8-a857-46b6-a2f8-479fd2b02e01',
];

function getCachedImages(): HeroImage[] | null {
  try {
    const raw = sessionStorage.getItem(HERO_IMAGES_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > HERO_IMAGES_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedImages(data: HeroImage[]) {
  try {
    sessionStorage.setItem(HERO_IMAGES_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

export function useHeroImage() {
  // Always start empty so SSG and client initial render produce identical output.
  // Reading sessionStorage during the render phase caused hydration mismatches on
  // repeat visits when the browser cache was already populated.
  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const cached = getCachedImages();
    if (cached && cached.length > 0) {
      setImages(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchImages() {
      try {
        const { data, error } = await supabase
          .from('gallery_items')
          .select('id, src, alt, title, width, height, focus_x, focus_y')
          .in('id', HERO_IMAGE_IDS)
          .eq('is_active', true);

        if (error || !data || data.length === 0 || cancelled) return;

        const orderedData = HERO_IMAGE_IDS
          .map(id => data.find(item => item.id === id))
          .filter(Boolean);

        const heroImages: HeroImage[] = orderedData.map((item: any) => ({
          src: item.src,
          alt: item.alt || item.title || 'Completed furniture assembly by Boxed2Built',
          title: item.title,
          width: item.width || 810,
          height: item.height || 1080,
          focusX: parseFloat(item.focus_x) || 50,
          focusY: parseFloat(item.focus_y) || 50,
        }));

        setCachedImages(heroImages);
        if (!cancelled) setImages(heroImages);
      } catch {
        // fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchImages();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  const goToIndex = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  return {
    image: images[activeIndex] || null,
    images,
    activeIndex,
    goToIndex,
    loading,
  };
}
