import React, { useEffect, useCallback } from 'react';
import { X, ZoomIn } from 'lucide-react';

export interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
}

/** Full-screen lightbox modal for a single image. */
const ImageLightbox: React.FC<ImageLightboxProps> = ({ image, onClose }) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!image) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [image, handleKeyDown]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        aria-label="Close image"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image — stop propagation so clicking the image itself doesn't close */}
      <img
        src={image.src}
        alt={image.alt}
        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default ImageLightbox;

/**
 * Wrapper that makes any <img> or content clickable to open a lightbox.
 * Usage:
 *   <ClickableImage src="..." alt="...">
 *     <img src="..." alt="..." />
 *   </ClickableImage>
 */
interface ClickableImageProps {
  src: string;
  alt: string;
  onOpen: (img: LightboxImage) => void;
  children: React.ReactNode;
  className?: string;
}

export const ClickableImage: React.FC<ClickableImageProps> = ({
  src,
  alt,
  onOpen,
  children,
  className = '',
}) => (
  <button
    type="button"
    className={`relative group cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl ${className}`}
    onClick={() => onOpen({ src, alt })}
    aria-label={`View larger: ${alt}`}
  >
    {children}
    {/* Zoom hint overlay */}
    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors duration-200">
      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 text-white rounded-full p-2">
        <ZoomIn className="w-6 h-6" />
      </span>
    </span>
  </button>
);
