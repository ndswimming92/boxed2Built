export interface PhotoFile {
  file: File;
  dataUrl: string;
}

export function downloadPhoto(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadAllPhotos(photos: PhotoFile[], jobClientName: string) {
  const timestamp = new Date().toISOString().split('T')[0];
  const sanitizedClientName = jobClientName.replace(/[^a-zA-Z0-9]/g, '-');

  photos.forEach((photo, index) => {
    const filename = `job-completion-${sanitizedClientName}-${timestamp}-photo-${index + 1}.jpg`;
    setTimeout(() => {
      downloadPhoto(photo.dataUrl, filename);
    }, index * 200); // Stagger downloads to avoid browser blocking
  });
}

export function downloadPhotoFromUrl(url: string, filename: string) {
  downloadPhoto(url, filename);
}

export async function sharePhoto(dataUrl: string, filename: string): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: 'image/jpeg' });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false;
    }

    await navigator.share({
      files: [file],
      title: 'Job Completion Photo',
    });

    return true;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error sharing photo:', error);
    }
    return false;
  }
}

export function openPhotoInNewTab(dataUrl: string): void {
  const newWindow = window.open();
  if (newWindow) {
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100vh; object-fit: contain; }
            .instructions { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 12px 24px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="instructions">Tap and hold the image, then select "Save to Photos"</div>
          <img src="${dataUrl}" alt="Job completion photo" />
        </body>
      </html>
    `);
    newWindow.document.close();
  }
}

export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function canShare(): boolean {
  return 'share' in navigator;
}
