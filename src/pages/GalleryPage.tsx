import React, { useEffect, useState } from 'react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import MediaGallery from '../components/sections/MediaGallery';
import { Camera, Video, Clock, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import CallButton from '../components/ui/CallButton';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';
import { usePublicGalleryItems } from '../hooks/useGalleryItems';
import { supabase } from '../lib/supabase';

const GalleryPage: React.FC = () => {
  const [businessId, setBusinessId] = useState<string>('');
  const { items: galleryItems, loading, error } = usePublicGalleryItems(businessId);

  useEffect(() => {
    const fetchBusinessId = async () => {
      try {
        const { data } = await supabase
          .from('business_info')
          .select('id')
          .eq('is_active', true)
          .maybeSingle();
        if (data) setBusinessId(data.id);
      } catch (err) {
        console.error('Error fetching business ID:', err);
      }
    };
    fetchBusinessId();
  }, []);

  useEffect(() => {
    document.title = 'Furniture Assembly Gallery | Boxed2Built Spring Hill';

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'View our furniture assembly gallery—real IKEA, Target, Walmart builds for families in Spring Hill, Franklin & surrounding TN areas.');
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/gallery');
  }, []);

  const handleBookingClick = () => {
    trackEvent('booking_click', 'gallery_page_cta', {
      event_category: 'conversion',
      event_label: 'book_consultation_gallery',
      value: 1,
      element_type: 'button',
      element_location: 'gallery_page_cta',
      page_section: 'gallery_page_cta',
      action_type: 'booking_click',
      conversion_type: 'calendly_booking'
    });
    window.open(getCalendlyUrl('services'), '_blank');
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="container mx-auto px-4 py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-700">Failed to load gallery items. Please try again later.</p>
            </div>
          </div>
        ) : (
          <MediaGallery
            items={galleryItems}
            title="Our Work"
            description=""
            className="bg-white"
          />
        )}

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
                <CallButton size="lg" pageSection="gallery_page_cta" />
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