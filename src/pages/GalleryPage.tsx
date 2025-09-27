import React, { useEffect } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import MediaGallery, { MediaItem } from '../components/sections/MediaGallery';
import { ChevronRight, Camera, Video, Clock, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';

// Sample media data - replace with your actual content
const SAMPLE_MEDIA: MediaItem[] = [
  // Videos
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
  
  // Photos
  {
    id: '3',
    type: 'image',
    src: '/images/assembled-barn-door-office-desk-hutch-spring-hill.webp',
    title: 'RedLemon 60" Farmhouse Desk with Hutch, Wood Home Office Executive Desk with Drawer, Charging Station, Keyboard Tray, File Drawer, Storage Cabinet, Rustic Writing Computer Desk (Dark Rustic Oak)',
    description: 'Professional furniture assembly of this RedLemon farmhouse desk with hutch featuring multiple drawers, charging station, keyboard tray, and storage compartments. Expert furniture assembly service in Spring Hill, Tennessee. Get this desk: https://amzn.to/3KHz4F7 - As an Amazon Associate I earn from qualifying purchases.',
    alt: 'Completed barn door office desk with hutch assembly showing professional furniture assembly work in Spring Hill TN',
    category: 'completed-work',
    date: '2024-12-20',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '4',
    type: 'image',
    src: '/images/unopened-flat-pack-furniture-boxes-spring-hill.webp',
    title: 'Unopened Flat Pack Furniture Boxes - Before Assembly',
    description: 'Flat pack furniture boxes before professional assembly service. Shows the starting point of our furniture assembly process in Spring Hill, TN homes.',
    alt: 'Unopened flat pack furniture boxes ready for professional assembly service in Spring Hill Tennessee',
    category: 'before-after',
    date: '2024-12-18',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '5',
    type: 'image',
    src: '/images/hardware-kit-unboxing-furniture-assembly-spring-hill.webp',
    title: 'Hardware Kit Unboxing - Furniture Assembly Process',
    description: 'Professional furniture assembly process showing organized hardware kit unboxing and preparation. Part of our meticulous furniture assembly service in Spring Hill, TN.',
    alt: 'Furniture assembly hardware kit unboxing showing professional organization and preparation process',
    category: 'process',
    date: '2024-12-18',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '6',
    type: 'image',
    src: '/images/black-rocking-chair-front-porch-spring-hill.webp',
    title: 'Shine Company Vermont Porch Rocker, High Back Wood Rocking Chair, Black',
    description: 'Professionally assembled Shine Company Vermont Porch Rocker placed on front porch in Spring Hill, TN. Expert furniture assembly service with final placement and positioning. Get this rocking chair: https://amzn.to/3VFC7A7 - As an Amazon Associate I earn from qualifying purchases.',
    alt: 'Black rocking chair professionally assembled and placed on front porch in Spring Hill Tennessee',
    category: 'completed-work',
    date: '2024-12-15',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '7',
    type: 'image',
    src: '/images/assembled-lighted-fireplace-console-spring-hill.webp',
    title: 'RedLemon Farmhouse Fireplace TV Stand for 80 Inch TV, 36" Tall Entertainment Center with 42" Crystal Eletric Fireplace, Modern Media Console Table with LED Lights for Living Room, Light Rustic Oak',
    description: 'Professional assembly of large fireplace console with built-in electric fireplace and LED lighting. Complex furniture assembly project completed in Spring Hill, Tennessee. Get this fireplace TV stand: https://amzn.to/46F5443 - As an Amazon Associate I earn from qualifying purchases.',
    alt: 'Assembled fireplace console with electric fireplace and LED lighting showing professional furniture assembly in Spring Hill TN',
    category: 'completed-work',
    date: '2024-12-22',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '12',
    type: 'image',
    src: '/images/white-over-toilet-bathroom-storage-spring-hill.webp',
    title: 'White Over-Toilet Bathroom Storage Assembly - Spring Hill TN',
    description: 'Professional assembly of white over-toilet bathroom storage unit with multiple shelves and cabinet doors. Expert furniture assembly service for bathroom organization in Spring Hill, Tennessee.',
    alt: 'White over-toilet bathroom storage unit professionally assembled showing shelving and cabinet storage in Spring Hill TN',
    category: 'completed-work',
    date: '2024-12-10',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '13',
    type: 'image',
    src: '/images/white-curtains-installed-on-wood-trim-window-spring-hill.webp',
    title: 'White Curtains Installed on Wood Trim Window - Spring Hill TN',
    description: 'Professional curtain rod installation and white curtain hanging service on wood trim window. Expert handyman services for window treatments in Spring Hill, Tennessee homes.',
    alt: 'White curtains professionally installed on wood trim window showing handyman installation service in Spring Hill TN',
    category: 'completed-work',
    date: '2024-12-08',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
];

const GalleryPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Furniture Assembly Gallery | Boxed2Built Spring Hill';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'View our furniture assembly gallery—real IKEA, Target, Walmart builds for families in Spring Hill, Franklin & surrounding TN areas.');
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
    trackEvent('calendly-booking-click-gallery-page');
    window.open(getCalendlyUrl('services'), '_blank');
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
                  trackingLabel="book-consultation-gallery-cta"
                >
                  <Clock size={20} className="mr-2" />
                  Book Free Consultation
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
                Weekend furniture assembly service • Serving Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood & surrounding Tennessee areas
              </p>
              
              <div className="mt-8 pt-6 border-t border-blue-500">
                <p className="text-xs text-blue-100">
                  <strong>Affiliate Disclosure:</strong> As an Amazon Associate I earn from qualifying purchases. 
                  Product links may contain affiliate links to help support our business.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default GalleryPage;