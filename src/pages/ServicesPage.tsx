import React, { useState } from 'react';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../components/seo/FAQSchema';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Services from '../components/sections/Services';
import HomeFAQ from '../components/sections/HomeFAQ';
import CallButton from '../components/ui/CallButton';
import Testimonials from '../components/sections/Testimonials';
import ImageLightbox, { ClickableImage, LightboxImage } from '../components/ui/ImageLightbox';
import { trackEvent } from '../utils/analytics';
import { useLoaderData } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { CompleteBusinessData } from '../lib/supabase';
import { LOCAL_SEO_CONTENT, FAQ_CONTENT } from '../constants/localSEO';

const ServicesPage: React.FC = () => {
  const { businessData } = useLoaderData() as { businessData: CompleteBusinessData };

  // Get high-value FAQ questions for services page
  const commonQuestions = FAQ_CONTENT.find(cat => cat.category === "Common Questions")?.questions || [];
  const servicesAndPricing = FAQ_CONTENT.find(cat => cat.category === "Services & Pricing")?.questions || [];

  const servicesFAQs = [
    commonQuestions[0], // Do Target and Walmart assemble furniture?
    commonQuestions[3], // Do you assemble IKEA, Target, and Walmart furniture?
    commonQuestions[2], // How long does furniture assembly usually take?
    servicesAndPricing[3], // What types of furniture can you assemble?
    servicesAndPricing[1], // What's included in the assembly price?
    servicesAndPricing[4], // Do you provide the tools and hardware?
  ];

  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  const handleEmailClick = () => {
    trackEvent('email_click', 'services_page_header', {
      event_category: 'contact',
      event_label: 'email_click_services',
      value: 1,
      element_type: 'link',
      element_location: 'services_page_header',
      page_section: 'services_page_header',
      action_type: 'email_click',
      conversion_type: 'email_lead',
    });

    window.location.href =
      'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Services%20Page&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Services%20Page';
  };

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.services.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.services.description} />
        <link rel="canonical" href="https://boxed2built.com/services" />
        <meta property="og:url" content="https://boxed2built.com/services" />
        <meta property="og:title" content="Furniture Assembly Services | Boxed2Built Spring Hill, TN" />
        <meta property="og:description" content="Expert furniture assembly services in Spring Hill, TN. IKEA, Target, Walmart and more — clear pricing, dependable service." />
        <meta name="twitter:title" content="Furniture Assembly Services | Boxed2Built" />
        <meta name="twitter:description" content="From IKEA to Target builds — Boxed2Built offers clear pricing and expert assembly in Spring Hill, TN." />
      </Head>
      <EnhancedLocalBusinessSchema businessData={businessData} includeReviews={false} pageType="services" />
      <FAQSchema faqs={servicesFAQs} />
      <Header />

      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Services', href: '/services', current: true },
                ]}
                className="mb-6"
              />

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Furniture Assembly Services in Spring Hill, TN
              </h1>

              <div className="space-y-6">
                <p className="text-lg md:text-xl text-gray-600">
                  IKEA, Walmart, Target, Wayfair &amp; Amazon furniture assembly—serving Spring Hill, Thompson’s
                  Station, Franklin &amp; Columbia.
                </p>

                <div className="mx-auto max-w-3xl rounded-2xl border border-blue-100 bg-white/80 p-5 text-left shadow-sm">
                  <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold mb-2">
                    Popular builds we assemble
                  </p>
                  <ul className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    <li className="flex items-center gap-2">
                      <span className="text-blue-600">•</span>
                      Beds, dressers, desks &amp; nightstands
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-600">•</span>
                      TV stands, shelving &amp; bookcases
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-600">•</span>
                      Dining tables, chairs &amp; office setups
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-600">•</span>
                      Electric fireplaces &amp; storage units
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-gray-600 md:text-base">
                  Searching “furniture assembly near me” in Spring Hill? You’re in the right place for fast, tidy,
                  and done-right installs.
                </p>
              </div>

              <div className="flex justify-center">
                <CallButton size="lg" pageSection="services_page_header" className="px-8 py-4" />
              </div>

              {/* Optional: keep the email click logic even if you add a visible email link later */}
              <button
                type="button"
                onClick={handleEmailClick}
                className="sr-only"
                aria-label="Email Boxed2Built for a quote"
              >
                Email
              </button>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <Services />

        {/* Testimonials */}
        <Testimonials />

        {/* FAQ Section */}
        <HomeFAQ
          faqs={servicesFAQs}
          title="Common Questions About Our Services"
          subtitle="Everything you need to know about furniture assembly in Spring Hill, TN"
          showViewAllLink={true}
        />

        {/* Additional Service Information */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">
                Why Choose Boxed2Built for Furniture Assembly?
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <ClickableImage
                    src="/images/marketing-images/Boxed2Built_Garage_Assembly.png"
                    alt="Professional garage furniture and storage assembly by Boxed2Built"
                    onOpen={setLightbox}
                    className="block w-full"
                  >
                    <img
                      src="/images/marketing-images/Boxed2Built_Garage_Assembly.png"
                      alt="Professional garage furniture and storage assembly by Boxed2Built"
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </ClickableImage>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Expert Furniture Assembly</h3>
                    <p className="text-gray-700 mb-4">
                      We specialize in assembling furniture from major brands like IKEA, Target, Walmart, Wayfair, and
                      Amazon. From simple chairs to complex bedroom sets, we handle the full build, placement, and cleanup.
                      Curious about our process?{' '}
                      <a href="/faq#build-day-process" className="text-blue-700 hover:text-blue-800 underline font-medium">
                        See what to expect on assembly day
                      </a>
                      . Read more{' '}
                      <a href="/about" className="text-blue-700 hover:text-blue-800 underline font-medium">
                        about Boxed2Built and our approach
                      </a>{' '}
                      to quality and care.
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Professional tools and equipment</li>
                      <li>• Careful, accurate builds</li>
                      <li>• Clean and efficient service</li>
                      <li>• Final check and tidy cleanup</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <ClickableImage
                    src="/images/marketing-images/Boxed2Built_Outdoor_Living.png"
                    alt="Outdoor furniture assembly and patio setup by Boxed2Built"
                    onOpen={setLightbox}
                    className="block w-full"
                  >
                    <img
                      src="/images/marketing-images/Boxed2Built_Outdoor_Living.png"
                      alt="Outdoor furniture assembly and patio setup by Boxed2Built"
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </ClickableImage>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Local Spring Hill Service Area</h3>
                    <p className="text-gray-700 mb-4">
                      Based in Spring Hill, TN, we proudly serve local families and nearby communities with reliable
                      furniture assembly and light handyman services. Most of our furniture assembly jobs are in Spring
                      Hill, Thompson’s Station, Franklin, and Columbia—especially for move-ins, nursery setups, and home
                      office builds. Learn more{' '}
                      <a href="/about" className="text-blue-700 hover:text-blue-800 underline font-medium">
                        about our local commitment
                      </a>{' '}
                      and family-focused approach.
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Spring Hill, Columbia, Franklin</li>
                      <li>• Thompson&apos;s Station, Brentwood</li>
                      <li>• Flexible scheduling options</li>
                      <li>• Community-focused service</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600 text-white p-8 rounded-lg text-center">
                <h3 className="text-xl font-bold mb-4">Ready to Get Started?</h3>
                <p className="text-blue-50 mb-6">
                  Contact us today for a free consultation and quote for your furniture assembly project.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <CallButton size="lg" pageSection="services_page_cta" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
};

export default ServicesPage;
