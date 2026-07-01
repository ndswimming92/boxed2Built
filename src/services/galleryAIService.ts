import { supabase } from '../lib/supabase';

export interface AIAnalysisResult {
  title: string;
  description: string;
  alt: string;
}

async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function analyzeGalleryImage(file: File, productUrl?: string): Promise<AIAnalysisResult> {
  const { base64, mediaType } = await fileToBase64(file);

  const body: Record<string, string> = { image: base64, mediaType };
  if (productUrl?.trim()) {
    body.productUrl = productUrl.trim();
  }

  const { data, error } = await supabase.functions.invoke('analyze-gallery-image', {
    body,
  });

  if (error) {
    throw new Error(error.message || 'AI analysis failed');
  }

  if (!data?.title || !data?.description || !data?.alt) {
    throw new Error('Incomplete AI response');
  }

  return { title: data.title, description: data.description, alt: data.alt };
}

export async function analyzeGalleryImageFromUrl(imageUrl: string, productUrl?: string): Promise<AIAnalysisResult> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Failed to fetch image');

  const blob = await response.blob();
  const file = new File([blob], 'image.webp', { type: blob.type || 'image/webp' });
  return analyzeGalleryImage(file, productUrl);
}
