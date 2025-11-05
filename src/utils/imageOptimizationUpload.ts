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

export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file'));

    img.onload = () => {
      try {
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
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = opts.convertToWebP ? 'image/webp' : file.type;
        const extension = opts.convertToWebP ? 'webp' : file.name.split('.').pop();
        const fileName = file.name.replace(/\.[^.]+$/, `.${extension}`);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            const optimizedFile = new File([blob], fileName, {
              type: mimeType,
              lastModified: Date.now(),
            });

            canvas.toBlob(
              (dataUrlBlob) => {
                if (!dataUrlBlob) {
                  reject(new Error('Failed to create data URL blob'));
                  return;
                }

                const dataUrlReader = new FileReader();
                dataUrlReader.onload = () => {
                  resolve({
                    file: optimizedFile,
                    dataUrl: dataUrlReader.result as string,
                    width,
                    height,
                    size: optimizedFile.size,
                  });
                };
                dataUrlReader.onerror = () => reject(new Error('Failed to read data URL'));
                dataUrlReader.readAsDataURL(dataUrlBlob);
              },
              mimeType,
              opts.quality
            );
          },
          mimeType,
          opts.quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    reader.readAsDataURL(file);
  });
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
