import React, { useState, useRef, useEffect } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

interface VideoPlayerProps {
  src: string;
  title: string;
  description?: string;
  thumbnail?: string;
  platform: 'youtube' | 'vimeo' | 'direct';
  aspectRatio?: '16:9' | '4:3' | '1:1';
  className?: string;
  lazy?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  description,
  thumbnail,
  platform,
  aspectRatio = '16:9',
  className = '',
  lazy = true
}) => {
  const [isLoaded, setIsLoaded] = useState(!lazy);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, [lazy]);

  const getEmbedUrl = (url: string, platform: string): string => {
    switch (platform) {
      case 'youtube':
        const youtubeId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        return `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`;
      case 'vimeo':
        const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
        return `https://player.vimeo.com/video/${vimeoId}`;
      default:
        return url;
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    trackEvent(`video-play-${platform}`, title);
  };

  const handleExternalLink = () => {
    trackEvent(`video-external-link-${platform}`, title);
    window.open(src, '_blank', 'noopener,noreferrer');
  };

  const aspectRatioClass = {
    '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',
    '1:1': 'aspect-square'
  }[aspectRatio];

  return (
    <div ref={videoRef} className={`relative ${aspectRatioClass} ${className}`}>
      {!isLoaded ? (
        <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <Play size={48} className="text-gray-400" />
        </div>
      ) : !isPlaying ? (
        <div className="relative w-full h-full group cursor-pointer" onClick={handlePlay}>
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={`${title} video thumbnail`}
              className="w-full h-full object-cover rounded-lg"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-gray-200 rounded-lg flex items-center justify-center">
              <Play size={48} className="text-blue-600" />
            </div>
          )}
          
          <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-20 transition-all duration-300 rounded-lg flex items-center justify-center">
            <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Play size={24} className="text-gray-800 ml-1" />
            </div>
          </div>
          
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-white font-semibold text-lg mb-1 drop-shadow-lg">{title}</h3>
            {description && (
              <p className="text-white text-sm opacity-90 drop-shadow-lg line-clamp-2">{description}</p>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExternalLink();
            }}
            className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
            aria-label={`Open ${title} in new tab`}
          >
            <ExternalLink size={16} />
          </button>
        </div>
      ) : (
        <iframe
          src={getEmbedUrl(src, platform)}
          title={title}
          className="w-full h-full rounded-lg"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      )}
    </div>
  );
};

export default VideoPlayer;