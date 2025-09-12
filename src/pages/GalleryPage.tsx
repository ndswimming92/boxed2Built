import React, { useEffect } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import MediaGallery, { MediaItem } from '../components/sections/MediaGallery';
import { ChevronRight, Camera, Video, Clock, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { trackEvent } from '../utils/analytics';

// Sample media data - replace with your actual content
const SAMPLE_MEDIA: MediaItem[] = [
  {
    id: '1',
    type: 'video',
    src: 'https://youtu.be/KBzfqI5YzSM',
    title: 'Furniture Assembly Time-lapse',
    description: 'Professional furniture assembly in action.',
    thumbnail: '/images/IMG_0217.jpeg',
    category: 'time-lapse',
    platform: 'youtube',
    date: '2024-12-01',
    width: 1260,
    height: 750
  },
  {
    id: '11',
    type: 'video',
    src: 'https://youtu.be/gu-T72iyrwI',
    title: 'Furniture Assembly Time-lapse #2',
    description: 'Another professional furniture assembly project in action.',
    thumbnail: '/images/IMG_0199.jpeg',
    category: 'time-lapse',
    platform: 'youtube',
    date: '2024-12-05',
    width: 1260,
    height: 750
  },
  {
    id: '2',
    type: 'image',
    src: '/images/IMG_0217.jpeg',
    title: 'Before: Unassembled Furniture',
    description: 'Furniture pieces before our professional assembly service begins.',
    category: 'photos',
    alt: 'Before - Unassembled furniture pieces before professional assembly service',
    width: 1260,
    height: 750
  },
  {
    id: '3',
    type: 'image',
    src: '/images/IMG_0199.jpeg',
    title: 'After: Completed Assembly Project',
    description: 'Professional furniture assembly completed and ready for use.',
    category: 'photos',
    alt: 'After - Completed furniture assembly project in Columbia Tennessee',
    width: 1260,
    height: 750
  },
  {
    id: '4',
    type: 'image',
    src: '/images/IMG_0214.jpeg',
    title: 'Professional Assembly Work',
    description: 'Quality craftsmanship and attention to detail in every furniture assembly project.',
    category: 'photos',
    alt: 'Professional furniture assembly work showing quality craftsmanship',
    width: 1260,
    height: 750
  },
  {
    id: '5',
    type: 'image',
    src: '/images/IMG_0196.jpeg',
    title: 'Furniture Assembly Project',
    description: 'Professional furniture assembly service in Spring Hill TN.',
    category: 'photos',
    alt: 'Professional furniture assembly project in Spring Hill Tennessee',
    width: 1260,
    height: 750
  },
  {
    id: '6',
    type: 'image',
    src: '/images/IMG_0225.jpeg',
    title: 'Completed Furniture Assembly',
    description: 'Finished furniture assembly project ready for use.',
    category: 'photos',
    alt: 'Completed furniture assembly project in Tennessee',
    width: 1260,
    height: 750
  },
  {
    id: '7',
    type: 'image',
    src: '/images/IMG_0223.jpeg',
    title: 'Assembly Work in Progress',
    description: 'Professional furniture assembly service in action.',
    category: 'photos',
    alt: 'Furniture assembly work in progress by professional service',
    width: 1260,
    height: 750
  },
  {
    id: '8',
    type: 'image',
    src: '/images/IMG_0220.jpeg',
    title: 'Assembly Tools and Workspace',
    description: 'Professional tools and workspace for furniture assembly.',
    category: 'photos',
    alt: 'Professional furniture assembly tools and organized workspace',
    width: 1260,
    height: 750
  },
  {
    id: '9',
    type: 'image',
    src: '/images/IMG_0224.jpeg',
    title: 'Quality Assembly Work',
    description: 'High-quality furniture assembly with attention to detail.',
    category: 'photos',
    alt: 'High-quality furniture assembly work with professional attention to detail',
    width: 1260,
    height: 750
  }
];

const GalleryPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Gallery - Professional Furniture Assembly Work | Boxed2Built Spring Hill TN';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'View our professional furniture assembly work in Spring Hill, TN. Time-lapse videos, before/after photos, and completed IKEA, Target, Walmart furniture projects.');
    }

    // Set canonical URL for this page
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/gallery');
  }, []);

  const handleBookingClick = () => {
    trackEvent('contact-click-gallery-page');
    window.location.href = '/contact';
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-gallery-page');
  };

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <nav className="flex items-center justify-center mb-6 text-sm">
                <a href="/" className="text-blue-700 hover:text-blue-800">Home</a>
                <ChevronRight size={16} className="mx-2 text-gray-400" />
                <span className="text-gray-600">Gallery</span>
              </nav>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Our Professional Furniture Assembly Work
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                See our expert furniture assembly in action with time-lapse videos, before & after photos, 
                and completed projects throughout Spring Hill, TN and surrounding areas.
              </p>
              
              <div className="flex flex-wrap justify-center items-center gap-8 text-sm">
                <div className="flex items-center text-gray-700">
                  <Video size={18} className="text-blue-700 mr-2" />
                  <span className="font-medium">Time-lapse Videos</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <Camera size={18} className="text-green-700 mr-2" />
                  <span className="font-medium">Before & After Photos</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-purple-700 mr-2" />
                  <span className="font-medium">Completed Projects</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Media Gallery */}
        <MediaGallery
          items={SAMPLE_MEDIA}
          title="Our Work"
          description=""
          className="bg-white"
        />

        {/* Call to Action */}
        <section className="py-12 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">Ready for Your Own Professional Assembly?</h2>
              <p className="text-xl text-blue-50 mb-8">
                Let us handle your furniture assembly project with the same care and expertise you see in our gallery.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <Button
                  onClick={handleBookingClick}
                  variant="white"
                  size="lg"
                  trackingLabel="contact-us-gallery-cta"
                >
                  <Phone size={20} className="mr-2" />
                  Contact Us for a Quote
                </Button>
                <a
                  href="tel:+19316741196"
                  onClick={handlePhoneClick}
                  className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
                >
                  <CheckCircle size={20} className="mr-2" />
                  <span className="mr-2">Call</span>
                  <img 
                    src="/images/contact/phone-number.svg" 
                    alt="(931) 674-1196" 
                    width="120" 
                    height="18"
                    className="inline-block"
                  />
                </a>
              </div>
              
              <p className="text-xs text-blue-50 font-medium">
                Serving Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood & surrounding Tennessee areas
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default GalleryPage;