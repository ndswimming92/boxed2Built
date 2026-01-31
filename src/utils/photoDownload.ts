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
    const file = new File([blob], filename, { type: blob.type });

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

export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function canShare(): boolean {
  return 'share' in navigator && 'canShare' in navigator;
}
