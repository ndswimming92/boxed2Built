import React, { useState } from 'react';
import { Calendar, MapPin, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
  category: 'before-after' | 'time-lapse' | 'completed-work' | 'process';
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
      case 'time-lapse':
        return '🎬';
      case 'photos':
        return '📸';
      default:
        return '📸';
    }
  };

  return (
    <section className={`py-12 ${className}`}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">{description}</p>
        </div>

        {/* Category Filter */}
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
              <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                {category.count}
              </span>
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              className="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => openLightbox(item, index)}
            >
              {item.type === 'image' ? (
                <div className="aspect-video relative overflow-hidden">
                  <OptimizedImage
                    src={item.src}
                    alt={item.alt || item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    width={400}
                    height={225}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300" />
                </div>
              ) : (
                <VideoPlayer
                  src={item.src}
                  title={item.title}
                  description={item.description}
                  thumbnail={item.thumbnail}
                  platform={item.platform || 'youtube'}
                  className="aspect-video"
                  lazy={true}
                />
              )}
              
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{getCategoryIcon(item.category)}</span>
                  <span className="text-xs text-blue-600 font-medium capitalize">
                    {item.category.replace('-', ' ')}
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.title}</h3>
                
                {item.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  {item.date && (
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>{item.date}</span>
                    </div>
                  )}
                  {item.location && (
                    <div className="flex items-center gap-1">
                      <MapPin size={12} />
                      <span>{item.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📸</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600">Try selecting a different category to see more content.</p>
          </div>
        )}

        {/* Lightbox Modal */}
        {lightboxItem && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
            <div className="relative max-w-6xl max-h-full w-full">
              {/* Close Button */}
              <button
                onClick={closeLightbox}
                className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                aria-label="Close lightbox"
              >
                <X size={24} />
              </button>

              {/* Navigation Buttons */}
              {filteredItems.length > 1 && (
                <>
                  <button
                    onClick={() => navigateLightbox('prev')}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => navigateLightbox('next')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                    aria-label="Next image"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              {/* Content */}
              <div className="bg-white rounded-lg overflow-hidden">
                {lightboxItem.type === 'image' ? (
                  <div className="relative">
                    <OptimizedImage
                      src={lightboxItem.src}
                      alt={lightboxItem.alt || lightboxItem.title}
                      className="w-full max-h-[70vh] object-contain"
                      priority={true}
                    />
                  </div>
                ) : (
                  <div className="aspect-video">
                    <VideoPlayer
                      src={lightboxItem.src}
                      title={lightboxItem.title}
                      description={lightboxItem.description}
                      thumbnail={lightboxItem.thumbnail}
                      platform={lightboxItem.platform || 'youtube'}
                      lazy={false}
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span>{getCategoryIcon(lightboxItem.category)}</span>
                    <span className="text-sm text-blue-600 font-medium capitalize">
                      {lightboxItem.category.replace('-', ' ')}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{lightboxItem.title}</h3>
                  
                  {lightboxItem.description && (
                    <p className="text-gray-600 mb-4">{lightboxItem.description}</p>
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

      {/* Schema Markup for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ImageGallery",
            "name": title,
            "description": description,
            "image": items
              .filter(item => item.type === 'image')
              .map(item => ({
                "@type": "ImageObject",
                "name": item.title,
                "description": item.description || item.title,
                "contentUrl": item.src,
                "thumbnailUrl": item.thumbnail || item.src,
                "uploadDate": item.date,
                "locationCreated": item.location
              })),
            "video": items
              .filter(item => item.type === 'video')
              .map(item => ({
                "@type": "VideoObject",
                "name": item.title,
                "description": item.description || item.title,
                "contentUrl": item.src,
                "thumbnailUrl": item.thumbnail,
                "uploadDate": item.date,
                "locationCreated": item.location
              }))
          })
        }}
      />
    </section>
  );
};

export default MediaGallery;