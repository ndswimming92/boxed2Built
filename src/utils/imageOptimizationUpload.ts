export interface OptimizedImage {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  convertToWebP?: boolean;
}

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.85,
  convertToWebP: true,
};

/**
 * Reads a File's bytes into memory and returns a new in-memory File copy.
 *
 * On mobile browsers (notably iOS Safari/Chrome) the File returned by a photo
 * picker is backed by a temporary on-disk file that the OS can regenerate or
 * delete between selection and use — e.g. HEIC->JPEG transcoding or temp-file
 * cleanup. Reading those bytes later then fails with
 * `net::ERR_UPLOAD_FILE_CHANGED`, which surfaces here as "Failed to load image".
 *
 * Call this immediately when a file is selected so the rest of the flow works
 * off an in-memory copy that cannot go stale.
 */
export async function snapshotFileToMemory(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  return new File([buffer], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load image'));
      image.src = objectUrl;
    });

    let { width, height } = img;

    if (width > opts.maxWidth || height > opts.maxHeight) {
      const aspectRatio = width / height;

      if (width > height) {
        width = Math.min(width, opts.maxWidth);
        height = Math.round(width / aspectRatio);
      } else {
        height = Math.min(height, opts.maxHeight);
        width = Math.round(height * aspectRatio);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = opts.convertToWebP ? 'image/webp' : file.type;
    const extension = opts.convertToWebP ? 'webp' : file.name.split('.').pop();
    const fileName = file.name.replace(/\.[^.]+$/, `.${extension}`);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error('Failed to create optimized image blob'));
            return;
          }
          resolve(b);
        },
        mimeType,
        opts.quality
      );
    });

    const optimizedFile = new File([blob], fileName, {
      type: mimeType,
      lastModified: Date.now(),
    });

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const dataUrlReader = new FileReader();
      dataUrlReader.onload = () => resolve(dataUrlReader.result as string);
      dataUrlReader.onerror = () => reject(new Error('Failed to create data URL'));
      dataUrlReader.readAsDataURL(blob);
    });

    return {
      file: optimizedFile,
      dataUrl,
      width,
      height,
      size: optimizedFile.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function optimizeImages(
  files: File[],
  options: ImageOptimizationOptions = {},
  onProgress?: (index: number, total: number) => void
): Promise<OptimizedImage[]> {
  const optimizedImages: OptimizedImage[] = [];

  for (let i = 0; i < files.length; i++) {
    try {
      const optimized = await optimizeImage(files[i], options);
      optimizedImages.push(optimized);
      onProgress?.(i + 1, files.length);
    } catch (error) {
      console.error(`Failed to optimize image ${files[i].name}:`, error);
      throw new Error(`Failed to optimize ${files[i].name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return optimizedImages;
}

export function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const nameWithoutExtension = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '-');

  return `${nameWithoutExtension}-${timestamp}-${randomString}.${extension}`;
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024;

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPEG, PNG, or WebP images.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 10MB limit.',
    };
  }

  return { valid: true };
}

export function validateImageFiles(files: File[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  files.forEach((file, index) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      errors.push(`File ${index + 1} (${file.name}): ${validation.error}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
