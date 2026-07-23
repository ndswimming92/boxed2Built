import { supabase } from '../lib/supabase';
import { OptimizedImage, generateUniqueFileName } from '../utils/imageOptimizationUpload';

export interface GalleryItem {
  id: string;
  business_id: string;
  type: 'image' | 'video';
  src: string;
  title: string;
  description?: string;
  thumbnail?: string;
  alt?: string;
  category: 'before-after' | 'time-lapse' | 'completed-work' | 'process' | 'photos';
  date?: string;
  location?: string;
  width?: number;
  height?: number;
  amazon_link?: string;
  platform?: 'youtube' | 'vimeo' | 'direct';
  display_order: number;
  is_active: boolean;
  show_on_website: boolean;
  eligible_for_social: boolean;
  focus_x?: number;
  focus_y?: number;
  facebook_post_id?: string | null;
  facebook_posted_at?: string | null;
  facebook_post_error?: string | null;
  instagram_post_id?: string | null;
  instagram_posted_at?: string | null;
  instagram_post_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGalleryItemInput {
  business_id: string;
  type: 'image' | 'video';
  src: string;
  title: string;
  description?: string;
  thumbnail?: string;
  alt?: string;
  category: 'before-after' | 'time-lapse' | 'completed-work' | 'process' | 'photos';
  date?: string;
  location?: string;
  width?: number;
  height?: number;
  amazon_link?: string;
  platform?: 'youtube' | 'vimeo' | 'direct';
  display_order?: number;
  is_active?: boolean;
  show_on_website?: boolean;
  eligible_for_social?: boolean;
  focus_x?: number;
  focus_y?: number;
}

export interface UpdateGalleryItemInput {
  title?: string;
  description?: string;
  thumbnail?: string;
  alt?: string;
  category?: 'before-after' | 'time-lapse' | 'completed-work' | 'process' | 'photos';
  date?: string;
  location?: string;
  width?: number;
  height?: number;
  amazon_link?: string;
  platform?: 'youtube' | 'vimeo' | 'direct';
  display_order?: number;
  is_active?: boolean;
  show_on_website?: boolean;
  eligible_for_social?: boolean;
  focus_x?: number;
  focus_y?: number;
}

export class GalleryService {
  private static readonly BUCKET_NAME = 'gallery-images';

  static async getAllGalleryItems(businessId: string, includeInactive = false): Promise<GalleryItem[]> {
    try {
      let query = supabase
        .from('gallery_items')
        .select('*')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true).eq('show_on_website', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching gallery items:', error);
      throw error;
    }
  }

  static async getGalleryItemById(id: string): Promise<GalleryItem | null> {
    try {
      const { data, error } = await supabase
        .from('gallery_items')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching gallery item:', error);
      throw error;
    }
  }

  static async uploadImage(optimizedImage: OptimizedImage, businessId: string): Promise<string> {
    try {
      const fileName = generateUniqueFileName(optimizedImage.file.name);
      const filePath = `${businessId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, optimizedImage.file, {
          contentType: optimizedImage.file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  static async createGalleryItem(input: CreateGalleryItemInput): Promise<GalleryItem> {
    try {
      const { data, error } = await supabase
        .from('gallery_items')
        .insert({
          business_id: input.business_id,
          type: input.type,
          src: input.src,
          title: input.title,
          description: input.description,
          thumbnail: input.thumbnail,
          alt: input.alt,
          category: input.category,
          date: input.date,
          location: input.location,
          width: input.width,
          height: input.height,
          amazon_link: input.amazon_link,
          platform: input.platform,
          display_order: input.display_order ?? 0,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating gallery item:', error);
      throw error;
    }
  }

  static async batchCreateGalleryItems(inputs: CreateGalleryItemInput[]): Promise<GalleryItem[]> {
    try {
      const { data, error } = await supabase
        .from('gallery_items')
        .insert(inputs.map(input => ({
          business_id: input.business_id,
          type: input.type,
          src: input.src,
          title: input.title,
          description: input.description,
          thumbnail: input.thumbnail,
          alt: input.alt,
          category: input.category,
          date: input.date,
          location: input.location,
          width: input.width,
          height: input.height,
          amazon_link: input.amazon_link,
          platform: input.platform,
          display_order: input.display_order ?? 0,
          is_active: input.is_active ?? true,
        })))
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error batch creating gallery items:', error);
      throw error;
    }
  }

  static async updateGalleryItem(id: string, input: UpdateGalleryItemInput): Promise<GalleryItem> {
    try {
      const { data, error } = await supabase
        .from('gallery_items')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Gallery item not found or could not be updated');
      return data;
    } catch (error) {
      console.error('Error updating gallery item:', error);
      throw error;
    }
  }

  static async deleteGalleryItem(id: string, permanent = false): Promise<void> {
    try {
      if (permanent) {
        const item = await this.getGalleryItemById(id);

        if (item && item.type === 'image' && item.src.includes(this.BUCKET_NAME)) {
          const pathMatch = item.src.match(/gallery-images\/(.+)$/);
          if (pathMatch) {
            await supabase.storage
              .from(this.BUCKET_NAME)
              .remove([pathMatch[1]]);
          }
        }

        const { error } = await supabase
          .from('gallery_items')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } else {
        await this.updateGalleryItem(id, { is_active: false });
      }
    } catch (error) {
      console.error('Error deleting gallery item:', error);
      throw error;
    }
  }

  static async restoreGalleryItem(id: string): Promise<GalleryItem> {
    return this.updateGalleryItem(id, { is_active: true });
  }

  static async deleteImageFromStorage(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting image from storage:', error);
      throw error;
    }
  }

  static async updateDisplayOrder(items: { id: string; display_order: number }[]): Promise<void> {
    try {
      const updates = items.map(item =>
        supabase
          .from('gallery_items')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
      );

      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating display order:', error);
      throw error;
    }
  }

  static async getMaxDisplayOrder(businessId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('gallery_items')
        .select('display_order')
        .eq('business_id', businessId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.display_order ?? 0;
    } catch (error) {
      console.error('Error getting max display order:', error);
      return 0;
    }
  }
}
