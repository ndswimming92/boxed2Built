import { useState, useEffect, useCallback } from 'react';
import { GalleryService } from '../services/galleryService';
import type { GalleryItem } from '../services/galleryService';
import type { MediaItem } from '../components/sections/MediaGallery';

export function useGalleryItems(businessId: string, includeInactive = false) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await GalleryService.getAllGalleryItems(businessId, includeInactive);
      setItems(data);
    } catch (err) {
      console.error('Error fetching gallery items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load gallery items');
    } finally {
      setLoading(false);
    }
  }, [businessId, includeInactive]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const refresh = useCallback(() => {
    return fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}

export function convertGalleryItemToMediaItem(item: GalleryItem): MediaItem {
  return {
    id: item.id,
    type: item.type,
    src: item.src,
    title: item.title,
    description: item.description || undefined,
    thumbnail: item.thumbnail || undefined,
    alt: item.alt || undefined,
    category: item.category,
    date: item.date || undefined,
    location: item.location || undefined,
    width: item.width || undefined,
    height: item.height || undefined,
    amazonLink: item.amazon_link || undefined,
    platform: item.platform || undefined,
    focusX: item.focus_x || 50,
    focusY: item.focus_y || 50,
  };
}

export function usePublicGalleryItems(businessId: string) {
  const { items, loading, error, refresh } = useGalleryItems(businessId, false);

  const mediaItems: MediaItem[] = items.map(convertGalleryItemToMediaItem);

  return {
    items: mediaItems,
    loading,
    error,
    refresh,
  };
}
