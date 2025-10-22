import React, { useEffect } from 'react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
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
    title: 'RedLemon 60" Farmhouse Desk with Hutch',
    description: 'Professional furniture assembly of this RedLemon farmhouse desk with hutch featuring multiple drawers, charging station, keyboard tray, and storage compartments. Expert furniture assembly service in Spring Hill, Tennessee.',
    alt: 'Completed barn door office desk with hutch assembly showing professional furniture assembly work in Spring Hill TN',
    category: 'completed-work',
    date: '2024-12-20',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600,
    amazonLink: 'https://amzn.to/3KHz4F7'
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
    title: 'Shine Company Vermont Porch Rocker',
    description: 'Professionally assembled Shine Company Vermont Porch Rocker placed on front porch in Spring Hill, TN. Expert furniture assembly service with final placement and positioning.',
    alt: 'Black rocking chair professionally assembled and placed on front porch in Spring Hill Tennessee',
    category: 'completed-work',
    date: '2024-12-15',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600,
    amazonLink: 'https://amzn.to/3VFC7A7'
  },
  {
    id: '7',
    type: 'image',
    src: '/images/assembled-lighted-fireplace-console-spring-hill.webp',
    title: 'RedLemon Farmhouse Fireplace TV Stand',
    description: 'Professional assembly of large fireplace console with built-in electric fireplace and LED lighting. Complex furniture assembly project completed in Spring Hill, Tennessee.',
    alt: 'Assembled fireplace console with electric fireplace and LED lighting showing professional furniture assembly in Spring Hill TN',
    category: 'completed-work',
    date: '2024-12-22',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600,
    amazonLink: 'https://amzn.to/46F5443'
  },
  {
    id: '12',
    type: 'image',
    src: '/images/white-over-toilet-bathroom-storage-spring-hill.webp',
    title: 'Ahomly Over The Toilet Storage Cabinet',
    description: 'Professional assembly of Ahomly over-toilet bathroom storage cabinet with adjustable shelves, toilet paper holder, and side hooks. Expert furniture assembly service for bathroom organization in Spring Hill, Tennessee.',
    alt: 'White over-toilet bathroom storage unit professionally assembled showing shelving and cabinet storage in Spring Hill TN',
    category: 'completed-work',
    date: '2024-12-10',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600,
    amazonLink: 'https://amzn.to/3VDFqYv'
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
  {
    id: '14',
    type: 'image',
    src: '/images/sauder-executive-desk-front-angle-spring-hill.webp',
    title: 'Sauder Executive Desk - Professional Assembly',
    description: 'Professionally assembled Sauder executive desk with 7 drawers featuring vintage oak finish. Complex furniture assembly with precision drawer alignment and hardware installation completed in Spring Hill, Tennessee.',
    alt: 'Sauder executive desk professionally assembled showing front angle view with multiple drawers in Spring Hill TN',
    category: 'completed-work',
    date: '2025-10-20',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '15',
    type: 'image',
    src: '/images/sauder-desk-box-closeup-spring-hill.webp',
    title: 'Sauder Desk Box - Before Assembly',
    description: 'Unopened Sauder executive desk boxes showing the before stage of our professional furniture assembly service. Expert assembly transforms flat-pack furniture into functional workspace in Spring Hill, TN homes.',
    alt: 'Sauder desk flat pack boxes before professional furniture assembly service in Spring Hill Tennessee',
    category: 'before-after',
    date: '2025-10-20',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '16',
    type: 'image',
    src: '/images/patio-heater-assembled-garage-spring-hill.webp',
    title: 'Patio Heater Assembly - Indoor Setup',
    description: 'Professional patio heater assembly completed in garage setting. Expert assembly service for outdoor heating equipment in Spring Hill, Tennessee. Safe and efficient installation ready for outdoor use.',
    alt: 'Assembled patio heater professionally completed in garage showing outdoor furniture assembly in Spring Hill TN',
    category: 'completed-work',
    date: '2025-10-18',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '17',
    type: 'image',
    src: '/images/black-adirondack-chair-completed-spring-hill.webp',
    title: 'Black Adirondack Chair - Outdoor Furniture Assembly',
    description: 'Professionally assembled black Adirondack chair with wide armrests completed in garage workspace. Expert outdoor furniture assembly service in Spring Hill, Tennessee.',
    alt: 'Black Adirondack chair professionally assembled showing outdoor furniture assembly expertise in Spring Hill TN',
    category: 'completed-work',
    date: '2025-10-22',
    location: 'Spring Hill, TN',
    width: 800,
    height: 600
  },
  {
    id: '18',
    type: 'image',
    src: '/images/assembled-2-drawer-filing-cabinet-spring-hill.webp',
    title: '2-Drawer Filing Cabinet - Professional Assembly',
    description: 'Professionally assembled 2-drawer filing cabinet with vintage oak finish. Precision drawer alignment and smooth glide hardware installation. Expert office furniture assembly service in Spring Hill, Tennessee.',
    alt: 'Two drawer filing cabinet professionally assembled showing quality office furniture assembly in Spring Hill TN',
    category: 'completed-work',
    date: '2025-10-21',
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
              <Breadcrumbs 
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Gallery', href: '/gallery', current: true }
                ]}
                className="mb-6"
              />
              
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
            </div>
          </div>
        </section>

        {/* Amazon Affiliate Disclosure Section */}
        <section className="py-8 bg-gray-100">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Amazon Affiliate Disclosure</h3>
                <p className="text-gray-700 mb-2">
                  <strong>Boxed2Built is a participant in the Amazon Services LLC Associates Program</strong>, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com.
                </p>
                <p className="text-gray-600 text-sm">
                  As an Amazon Associate, we earn from qualifying purchases made through the product links on this page. 
                  These affiliate links help support our furniture assembly business at no extra cost to you. 
                  We only recommend products that we have personally assembled and believe will be valuable to our customers.
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