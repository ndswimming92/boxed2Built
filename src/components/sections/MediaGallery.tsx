import React, { useState } from 'react';
import { Calendar, MapPin, X, ChevronLeft, ChevronRight } from 'lucide-react';
import OptimizedImage from '../ui/OptimizedImage';
import VideoPlayer from '../ui/VideoPlayer';
import { trackEvent } from '../../utils/analytics';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date?: string;
  location?: string;
  category: 'before-after' | 'time-lapse' | 'completed-work' | 'process' | 'photos';
  platform?: 'youtube' | 'vimeo' | 'direct';
  alt?: string;
  width?: number;
  height?: number;
}

interface MediaGalleryProps {
  items: MediaItem[];
  title?: string;
  description?: string;
  className?: string;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  items,
  title = "Our Work Gallery",
  description = "See our professional furniture assembly projects in action",
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const categories = [
    { key: 'all', label: 'All Work', count: items.length },
    { key: 'photos', label: 'Photos', count: items.filter(item => item.category === 'photos').length },
    { key: 'time-lapse', label: 'Time-lapse Videos', count: items.filter(item => item.category === 'time-lapse').length }
  ].filter(cat => cat.count > 0);

  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category === selectedCategory);

  const openLightbox = (item: MediaItem, index: number) => {
    setLightboxItem(item);
    setLightboxIndex(index);
    trackEvent('gallery-lightbox-open', item.title);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxItem(null);
    trackEvent('gallery-lightbox-close');
    document.body.style.overflow = 'unset';
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    const currentIndex = filteredItems.findIndex(item => item.id === lightboxItem?.id);
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
    } else {
      newIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
    }
    setLightboxItem(filteredItems[newIndex]);
    setLightboxIndex(newIndex);
    trackEvent(`gallery-lightbox-${direction}`, filteredItems[newIndex].title);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'time-lapse': return '🎬';
      case 'photos': return '📸';
      default: return '📸';
    }
  };

  return (
    <section className={`py-12 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">{description}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {categories.map((category) => (
            <button
              key={category.key}
              onClick={() => {
                setSelectedCategory(category.key);
                trackEvent('gallery-filter-change', category.key);
              }}
              className={`px-4 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
                selectedCategory === category.key
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{getCategoryIcon(category.key)}</span>
              <span>{category.label}</span>
              <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">{category.count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              className="group relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-300 rounded-lg"
              onClick={() => openLightbox(item, index)}
            >
              {item.type === 'image' ? (
                <div className="aspect-square relative overflow-hidden border-2 border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-300">
                  <OptimizedImage
                    src={item.src}
                    alt={item.alt || item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    width={item.width || 400}
                    height={item.height || 300}
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                    imageType="thumbnail"
                    quality={75}
                    enableAvif={true}
                  />
                </div>
              ) : (
                <div className="group relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-300 rounded-lg bg-white shadow-sm hover:shadow-md">
                  <div className="aspect-square relative overflow-hidden transition-all duration-300">
                    <VideoPlayer
                      src={item.src}
                      title={item.title}
                      description={item.description}
                      thumbnail={item.thumbnail}
                      platform={item.platform || 'youtube'}
                      className="aspect-video transition-all duration-300"
                      lazy={true}
                      width={item.width}
                      height={item.height}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📸</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600">Try selecting a different category to see more content.</p>
          </div>
        )}

        {lightboxItem && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
            <div className="relative max-w-3xl w-full max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
              <button
                onClick={closeLightbox}
                className="absolute top-2 right-2 z-10 p-2 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full"
                aria-label="Close lightbox"
              >
                <X size={24} />
              </button>

              {filteredItems.length > 1 && (
                <>
                  <button
                    onClick={() => navigateLightbox('prev')}
                    className="fixed left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => navigateLightbox('next')}
                    className="fixed right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full"
                    aria-label="Next image"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              <div className="flex flex-col h-full">
                <div className="flex-1 max-h-[60vh] flex justify-center items-center bg-gray-100 p-4 overflow-hidden">
                  {lightboxItem.type === 'image' ? (
                    <OptimizedImage
                      src={lightboxItem.src}
                      alt={lightboxItem.alt || lightboxItem.title}
                      className="max-h-full max-w-full object-contain rounded-md shadow"
                      priority={true}
                      imageType="gallery"
                      quality={90}
                      enableAvif={true}
                    />
                  ) : (
                    <VideoPlayer
                      src={lightboxItem.src}
                      title={lightboxItem.title}
                      description={lightboxItem.description}
                      thumbnail={lightboxItem.thumbnail}
                      platform={lightboxItem.platform || 'youtube'}
                      className="aspect-video"
                      lazy={false}
                    />
                  )}
                </div>

                <div className="max-h-[30vh] overflow-y-auto p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <span>{getCategoryIcon(lightboxItem.category)}</span>
                    <span className="text-sm text-blue-600 font-medium capitalize">
                      {lightboxItem.category.replace('-', ' ')}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">{lightboxItem.title}</h3>

                  {lightboxItem.description && (
                    <p className="text-gray-600 mb-3 text-sm leading-relaxed">{lightboxItem.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {lightboxItem.date && (
                      <div className="flex items-center gap-1">
                        <Calendar size={16} />
                        <span>{lightboxItem.date}</span>
                      </div>
                    )}
                    {lightboxItem.location && (
                      <div className="flex items-center gap-1">
                        <MapPin size={16} />
                        <span>{lightboxItem.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default MediaGallery;