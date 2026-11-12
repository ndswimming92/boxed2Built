import React, { useMemo, useState } from 'react';
import { Calendar, MapPin, X, ChevronLeft, ChevronRight, ArrowRight, Expand } from 'lucide-react';
import OptimizedImage from '../ui/OptimizedImage';
import VideoPlayer from '../ui/VideoPlayer';
import { trackEvent } from '../../utils/analytics';
import {
  GALLERY_ROOMS,
  GALLERY_SERVICE_TYPES,
  roomLabel,
  serviceTypeLabel,
  type GalleryRoom,
  type GalleryServiceType,
} from '../../utils/galleryTaxonomy';

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
  serviceType?: GalleryServiceType;
  room?: GalleryRoom | null;
  platform?: 'youtube' | 'vimeo' | 'direct';
  alt?: string;
  width?: number;
  height?: number;
  focusX?: number;
  focusY?: number;
}

interface MediaGalleryProps {
  items: MediaItem[];
  title?: string;
  description?: string;
  className?: string;
}

/** How many grid cards to show before the visitor asks for more. */
const PAGE_SIZE = 12;
/** Below this many items a featured project would leave the grid looking empty. */
const MIN_ITEMS_FOR_FEATURED = 5;

const MediaGallery: React.FC<MediaGalleryProps> = ({
  items,
  title = "Our Work Gallery",
  description = "See our professional furniture assembly projects in action",
  className = ''
}) => {
  const [selectedService, setSelectedService] = useState<'all' | GalleryServiceType>('all');
  const [selectedRoom, setSelectedRoom] = useState<'all' | GalleryRoom>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);

  const serviceFilters = useMemo(
    () => [
      { key: 'all' as const, label: 'All Work', count: items.length },
      ...GALLERY_SERVICE_TYPES.map((service) => ({
        key: service.key,
        label: service.label,
        count: items.filter((item) => item.serviceType === service.key).length,
      })).filter((service) => service.count > 0),
    ],
    [items]
  );

  const serviceItems = useMemo(
    () => (selectedService === 'all' ? items : items.filter((item) => item.serviceType === selectedService)),
    [items, selectedService]
  );

  const roomFilters = useMemo(
    () =>
      GALLERY_ROOMS.map((room) => ({
        key: room.key,
        label: room.label,
        count: serviceItems.filter((item) => item.room === room.key).length,
      })).filter((room) => room.count > 0),
    [serviceItems]
  );

  const filteredItems = useMemo(
    () => (selectedRoom === 'all' ? serviceItems : serviceItems.filter((item) => item.room === selectedRoom)),
    [serviceItems, selectedRoom]
  );

  const isFiltered = selectedService !== 'all' || selectedRoom !== 'all';
  const featuredItem =
    !isFiltered && items.length >= MIN_ITEMS_FOR_FEATURED
      ? filteredItems.find((item) => item.type === 'image')
      : undefined;
  const gridItems = featuredItem ? filteredItems.filter((item) => item.id !== featuredItem.id) : filteredItems;
  const visibleItems = gridItems.slice(0, visibleCount);
  const remaining = gridItems.length - visibleItems.length;

  const selectService = (key: 'all' | GalleryServiceType) => {
    setSelectedService(key);
    setSelectedRoom('all');
    setVisibleCount(PAGE_SIZE);
    trackEvent('gallery-filter-change', key);
  };

  const selectRoom = (key: 'all' | GalleryRoom) => {
    setSelectedRoom(key);
    setVisibleCount(PAGE_SIZE);
    trackEvent('gallery-room-filter-change', key);
  };

  const clearFilters = () => {
    setSelectedService('all');
    setSelectedRoom('all');
    setVisibleCount(PAGE_SIZE);
  };

  const openLightbox = (item: MediaItem) => {
    setLightboxItem(item);
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
    trackEvent(`gallery-lightbox-${direction}`, filteredItems[newIndex].title);
  };

  const metaLine = (item: MediaItem) =>
    [item.location, item.room ? roomLabel(item.room) : null].filter(Boolean).join(' · ');

  return (
    <section className={`py-12 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{title}</h2>
          {description && <p className="text-lg text-gray-600 max-w-2xl mx-auto">{description}</p>}
        </div>

        {/* Filters */}
        {serviceFilters.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4">
            {serviceFilters.map((service) => {
              const active = selectedService === service.key;
              return (
                <button
                  key={service.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectService(service.key)}
                  className={`px-4 py-2 rounded-full text-sm sm:text-base font-medium transition-colors duration-200 flex items-center gap-2 ${
                    active
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{service.label}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                    }`}
                  >
                    {service.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {roomFilters.length > 1 && (
          <div className="flex flex-wrap justify-center items-center gap-x-1 gap-y-2 mb-10 text-sm">
            <span className="text-gray-500 mr-1">Room:</span>
            {[{ key: 'all' as const, label: 'Any', count: serviceItems.length }, ...roomFilters].map((room) => {
              const active = selectedRoom === room.key;
              return (
                <button
                  key={room.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectRoom(room.key)}
                  className={`px-3 py-1 rounded-full border transition-colors duration-200 ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-transparent text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {room.label}
                  {room.key !== 'all' && <span className="ml-1 text-gray-400 font-normal">{room.count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Featured project */}
        {featuredItem && (
          <article className="grid md:grid-cols-5 overflow-hidden rounded-2xl bg-gray-50 border border-gray-200 mb-10">
            <button
              type="button"
              onClick={() => openLightbox(featuredItem)}
              aria-label={`View larger photo: ${featuredItem.title}`}
              className="group relative md:col-span-3 aspect-4/3 md:aspect-auto md:min-h-[420px] overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0">
                <OptimizedImage
                  src={featuredItem.src}
                  alt={featuredItem.alt || featuredItem.title}
                  className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 60vw"
                  imageType="gallery"
                  enableAvif={true}
                  focusX={featuredItem.focusX}
                  focusY={featuredItem.focusY}
                />
              </div>
              <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
                <Expand size={14} />
                View photo
              </span>
            </button>

            <div className="md:col-span-2 flex flex-col justify-center p-6 md:p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-3">Featured project</p>
              <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">{featuredItem.title}</h3>
              {featuredItem.description && (
                <p className="text-gray-600 leading-relaxed mb-4 line-clamp-4">{featuredItem.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 mb-6">
                {featuredItem.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={15} className="text-gray-400" />
                    {featuredItem.location}
                  </span>
                )}
                {featuredItem.serviceType && (
                  <span className="rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {serviceTypeLabel(featuredItem.serviceType)}
                  </span>
                )}
              </div>
              <a
                href="/contact"
                onClick={() => trackEvent('gallery-featured-quote-click', featuredItem.title)}
                className="group inline-flex items-center gap-2 self-start rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Get a quote for a build like this
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </article>
        )}

        {/* Grid */}
        {featuredItem && visibleItems.length > 0 && (
          <h3 className="text-lg font-semibold text-gray-900 mb-4">More recent projects</h3>
        )}
        {isFiltered && filteredItems.length > 0 && (
          <p className="text-sm text-gray-500 mb-4">
            Showing {filteredItems.length} {filteredItems.length === 1 ? 'project' : 'projects'}
            {' · '}
            <button type="button" onClick={clearFilters} className="text-blue-700 hover:text-blue-800 underline">
              Clear filters
            </button>
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 mb-10">
          {visibleItems.map((item) => (
            <div key={item.id} className="group">
              {item.type === 'image' ? (
                <button
                  type="button"
                  onClick={() => openLightbox(item)}
                  aria-label={`View larger photo: ${item.title}`}
                  className="block w-full aspect-4/5 overflow-hidden rounded-xl bg-gray-100 cursor-pointer shadow-sm group-hover:shadow-lg transition-shadow duration-300"
                >
                  <OptimizedImage
                    src={item.src}
                    alt={item.alt || item.title}
                    className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                    fill
                    width={item.width || 400}
                    height={item.height || 500}
                    loading="lazy"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    imageType="thumbnail"
                    quality={75}
                    enableAvif={true}
                    focusX={item.focusX}
                    focusY={item.focusY}
                  />
                </button>
              ) : (
                <div
                  className="aspect-4/5 overflow-hidden rounded-xl bg-black flex items-center cursor-pointer"
                  onClick={() => openLightbox(item)}
                >
                  <VideoPlayer
                    src={item.src}
                    title={item.title}
                    description={item.description}
                    thumbnail={item.thumbnail}
                    platform={item.platform || 'youtube'}
                    className="aspect-video w-full"
                    lazy={true}
                    width={item.width}
                    height={item.height}
                  />
                </div>
              )}

              <div className="pt-3 px-0.5">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{item.title}</h3>
                {metaLine(item) && <p className="mt-1 text-xs text-gray-500">{metaLine(item)}</p>}
              </div>
            </div>
          ))}
        </div>

        {remaining > 0 && (
          <div className="text-center mb-10">
            <button
              type="button"
              onClick={() => {
                setVisibleCount((count) => count + PAGE_SIZE);
                trackEvent('gallery-load-more', String(visibleCount + PAGE_SIZE));
              }}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-600 px-6 py-3 font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Show more projects
              <span className="text-sm font-normal text-blue-600">({remaining} more)</span>
            </button>
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600">
              {isFiltered ? (
                <button type="button" onClick={clearFilters} className="text-blue-700 hover:text-blue-800 underline">
                  Clear filters to see all of our work
                </button>
              ) : (
                'Check back soon for new projects.'
              )}
            </p>
          </div>
        )}

        {lightboxItem && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="relative max-w-3xl w-full max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
              <button
                onClick={closeLightbox}
                className="absolute top-2 right-2 z-10 p-2 bg-black/70 hover:bg-black/90 text-white rounded-full"
                aria-label="Close lightbox"
              >
                <X size={24} />
              </button>

              {filteredItems.length > 1 && (
                <>
                  <button
                    onClick={() => navigateLightbox('prev')}
                    className="fixed left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black/70 hover:bg-black/90 text-white rounded-full"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => navigateLightbox('next')}
                    className="fixed right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black/70 hover:bg-black/90 text-white rounded-full"
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
                      focusX={lightboxItem.focusX}
                      focusY={lightboxItem.focusY}
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
                  {(lightboxItem.serviceType || lightboxItem.room) && (
                    <p className="text-sm text-blue-700 font-medium mb-2">
                      {[
                        lightboxItem.serviceType ? serviceTypeLabel(lightboxItem.serviceType) : null,
                        lightboxItem.room ? roomLabel(lightboxItem.room) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}

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
