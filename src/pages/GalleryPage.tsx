import React from 'react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import MediaGallery from '../components/sections/MediaGallery';
import { Camera, Video, CheckCircle, ArrowRight } from 'lucide-react';
import CallButton from '../components/ui/CallButton';
import { usePublicGalleryItems } from '../hooks/useGalleryItems';
import { useLoaderData } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { CompleteBusinessData } from '../lib/supabase';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';

const GalleryPage: React.FC = () => {
  const { businessData } = useLoaderData() as { businessData: CompleteBusinessData };
  const businessId = businessData?.info?.id || '';
  const { items: galleryItems, loading, error } = usePublicGalleryItems(businessId);



  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.gallery.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.gallery.description} />
        <link rel="canonical" href="https://boxed2built.com/gallery" />
        <meta property="og:url" content="https://boxed2built.com/gallery" />
        <meta property="og:title" content="Furniture Assembly Gallery | Boxed2Built Spring Hill, TN" />
        <meta property="og:description" content="Real IKEA, Target, Walmart furniture builds for families in Spring Hill and surrounding TN communities." />
        <meta name="twitter:title" content="Our Work Gallery | Boxed2Built" />
        <meta name="twitter:description" content="See real furniture assembly results from Spring Hill, Franklin, and surrounding TN areas." />
      </Head>
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
                See our expert{' '}
                <a href="/services/furniture-assembly" className="text-blue-700 hover:text-blue-800 underline font-medium">
                  furniture assembly
                </a>{' '}
                in action with time-lapse videos, before & after photos,
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

        {/* Related Services */}
        <section className="py-8 bg-gray-50 border-t border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
                Book a Service
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <a
                  href="/services/furniture-assembly"
                  className="group flex items-center justify-between bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg px-5 py-4 shadow-sm transition-colors"
                >
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">Professional Furniture Assembly</p>
                    <p className="text-gray-500 text-xs mt-0.5">IKEA, Target, Walmart &amp; all brands</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </a>
                <a
                  href="/services/tv-mounting"
                  className="group flex items-center justify-between bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg px-5 py-4 shadow-sm transition-colors"
                >
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">Professional TV Mounting</p>
                    <p className="text-gray-500 text-xs mt-0.5">All wall types, cable management included</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-12 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">Ready for Your Own Professional Assembly?</h2>
              <p className="text-xl text-blue-50 mb-8">
                Let us handle your furniture assembly project with the same care and expertise you see in our gallery.
                Explore our{' '}
                <a href="/services" className="text-white hover:text-blue-100 underline font-semibold">
                  full range of services
                </a>{' '}
                or{' '}
                <a href="/contact" className="text-white hover:text-blue-100 underline font-semibold">
                  get in touch
                </a>{' '}
                for a free quote.
              </p>

              <div className="flex justify-center mb-6">
                <CallButton size="lg" pageSection="gallery_page_cta" />
              </div>
              
              <p className="text-xs text-blue-50 font-medium">
                Weekend furniture assembly service • Serving Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood & surrounding Tennessee areas
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
