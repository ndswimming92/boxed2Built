import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Shield, Trash2, Star, Home, ArrowRight } from 'lucide-react';
import EnhancedLocalBusinessSchema from '../../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../../components/seo/FAQSchema';
import BreadcrumbSchema from '../../components/seo/BreadcrumbSchema';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import CallButton from '../../components/ui/CallButton';
import Testimonials from '../../components/sections/Testimonials';
import { trackEvent } from '../../utils/analytics';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { formatPhoneForDisplay } from '../../services/communicationService';
import { usePageMeta } from '../../hooks/usePageMeta';
import { LOCAL_SEO_CONTENT, PRIMARY_SERVICES, FAQ_CONTENT, SERVICE_AREAS } from '../../constants/localSEO';

const FurnitureAssemblyPage: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();
  const phoneDisplay = formatPhoneForDisplay((businessData?.info?.phone || '+16155511402').replace(/^\+1/, ''));

  usePageMeta({
    title: LOCAL_SEO_CONTENT.furnitureAssembly.title,
    description: LOCAL_SEO_CONTENT.furnitureAssembly.description,
    canonicalUrl: 'https://boxed2built.com/services/furniture-assembly',
    ogTitle: 'Furniture Assembly Service in Spring Hill, TN',
    ogDescription: 'Book professional furniture assembly with Boxed2Built for IKEA, Target, Walmart, and more in Spring Hill, TN.',
    twitterTitle: 'Furniture Assembly | Boxed2Built',
    twitterDescription: 'Professional furniture assembly service in Spring Hill, TN from Boxed2Built.',
  });

  const commonQuestions = FAQ_CONTENT.find(cat => cat.category === "Common Questions")?.questions || [];
  const servicesAndPricing = FAQ_CONTENT.find(cat => cat.category === "Services & Pricing")?.questions || [];

  const furnitureAssemblyFAQs = [
    commonQuestions[3],
    commonQuestions[0],
    commonQuestions[2],
    servicesAndPricing[0],
    servicesAndPricing[3],
    servicesAndPricing[4],
  ].filter(Boolean);

  const handleContactClick = (source: string) => {
    trackEvent('contact_click', source, {
      event_category: 'contact',
      event_label: `${source}_furniture_assembly`,
      page_section: 'furniture_assembly_page',
    });
  };

  return (
    <>
      <EnhancedLocalBusinessSchema businessData={businessData} />
      <FAQSchema faqs={furnitureAssemblyFAQs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: 'https://boxed2built.com/' },
        { name: 'Services', url: 'https://boxed2built.com/services' },
        { name: 'Furniture Assembly', url: 'https://boxed2built.com/services/furniture-assembly' },
      ]} />
      <Header />

      <main className="min-h-screen">
        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-32 pb-16">
          <div className="container mx-auto px-4">
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Services', href: '/services' },
                { label: 'Furniture Assembly', href: '/services/furniture-assembly' }
              ]}
            />

            <div className="max-w-6xl mx-auto mt-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="text-center lg:text-left">
                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                    Professional Furniture Assembly Services in Spring Hill, TN
                  </h1>
                  <p className="text-xl text-gray-700 mb-8 leading-relaxed">
                    Expert assembly for IKEA, Target, Walmart, Wayfair, and Amazon furniture. Fast, reliable service with transparent pricing and no hidden fees.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <CallButton size="lg" pageSection="furniture_assembly_hero" />
                    <Link
                      to="/contact"
                      onClick={() => handleContactClick('hero_quote')}
                      className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-md border-2 border-blue-700"
                    >
                      Get Free Quote
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <img
                    src="/images/marketing-images/Boxed2Built_Bedroom_Assembly.png"
                    alt="Professional bedroom furniture assembly - dresser, bed frame, and nightstand built by Boxed2Built"
                    className="rounded-xl shadow-xl w-full h-auto object-cover"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                Why Choose Boxed2Built for Furniture Assembly?
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  {
                    icon: CheckCircle2,
                    title: 'Expert Assembly',
                    description: 'Professional assembly for all major brands including IKEA, Target, Walmart, Wayfair, and Amazon furniture.'
                  },
                  {
                    icon: Clock,
                    title: 'Fast & Reliable',
                    description: 'Efficient service that respects your time. Most items assembled in 1-3 hours with flexible weekend scheduling.'
                  },
                  {
                    icon: Trash2,
                    title: 'Complete Cleanup',
                    description: 'We remove all packaging materials, boxes, and debris. You enjoy your furniture without any mess.'
                  },
                  {
                    icon: Shield,
                    title: 'Satisfaction Guaranteed',
                    description: 'Quality workmanship backed by our guarantee. We ensure every piece is sturdy, safe, and properly assembled.'
                  }
                ].map((feature, index) => (
                  <div key={index} className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                      <feature.icon className="w-8 h-8 text-blue-700" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
                Furniture Assembly Services & Pricing
              </h2>
              <p className="text-lg text-gray-700 mb-12 text-center">
                Transparent pricing with no hidden fees. All services include complete assembly, placement, and cleanup.
              </p>
              <div className="grid gap-6">
                {PRIMARY_SERVICES.map((service, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
                        <p className="text-gray-600">{service.description}</p>
                      </div>
                      <div className="mt-4 sm:mt-0 sm:ml-6 text-right">
                        <div className="text-sm text-gray-500 mb-1">starting at</div>
                        <div className="text-3xl font-bold text-blue-700">${service.price}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center">
                <p className="text-gray-600 mb-4">Need multiple items assembled? Ask about our volume discounts.</p>
                <Link
                  to="/contact"
                  onClick={() => handleContactClick('pricing_quote')}
                  className="inline-flex items-center text-blue-700 font-semibold hover:text-blue-800 transition-colors"
                >
                  Get a Custom Quote
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                Our Furniture Assembly Process
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                  {[
                    {
                      step: '1',
                      title: 'Schedule Your Service',
                      description: `Call us at ${phoneDisplay} or book online. We offer flexible weekend appointments that work with your schedule.`
                    },
                    {
                      step: '2',
                      title: 'We Arrive On Time',
                      description: "Receive a 30-minute courtesy call before arrival. We bring all professional tools and equipment needed for the job."
                    },
                    {
                      step: '3',
                      title: 'Expert Assembly',
                      description: 'We carefully unbox, assemble, and position your furniture according to manufacturer specifications and your preferences.'
                    },
                    {
                      step: '4',
                      title: 'Quality Inspection',
                      description: 'Every piece is thoroughly checked for stability and safety. We ensure all hardware is properly installed and secure.'
                    },
                    {
                      step: '5',
                      title: 'Complete Cleanup',
                      description: 'We remove all packaging materials, boxes, and debris. Your space is left clean and ready to enjoy.'
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-700 text-white rounded-full flex items-center justify-center text-xl font-bold">
                          {item.step}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                        <p className="text-gray-600 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden lg:block sticky top-24">
                  <img
                    src="/images/marketing-images/Boxed2Built_Skip_The_Build_Enjoy_Moments.png"
                    alt="Skip the build and enjoy the moments - professional furniture assembly service"
                    className="rounded-xl shadow-lg w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                Furniture Brands We Assemble
              </h2>
              <p className="text-xl text-center mb-12">
                We have experience assembling furniture from all major retailers and brands. If it comes in a box with instructions, we can build it!
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
                {[
                  'IKEA',
                  'Target',
                  'Walmart',
                  'Wayfair',
                  'Amazon',
                  'Ashley Furniture',
                  'Sauder',
                  'Better Homes & Gardens',
                  'Mainstays',
                  'Room Essentials',
                  'Threshold',
                  'And Many More'
                ].map((brand, index) => (
                  <div key={index} className="bg-blue-600 rounded-lg p-4 font-semibold">
                    {brand}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center mb-8">
                <Home className="w-10 h-10 text-blue-700 mr-3" />
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Service Areas
                </h2>
              </div>
              <p className="text-lg text-gray-700 mb-8 text-center">
                Proudly serving Spring Hill and surrounding communities in Tennessee
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {SERVICE_AREAS.map((area, index) => (
                  <div key={index} className="bg-white rounded-lg shadow p-4 text-gray-700 font-medium">
                    {area}
                  </div>
                ))}
              </div>
              <p className="text-center text-gray-600 mt-8">
                Not sure if we serve your area? <Link to="/contact" className="text-blue-700 hover:text-blue-800 font-semibold">Contact us</Link> to find out!
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <Testimonials />
          </div>
        </section>

        {furnitureAssemblyFAQs.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                  Frequently Asked Questions
                </h2>
                <div className="space-y-6">
                  {furnitureAssemblyFAQs.map((faq, index) => (
                    <details key={index} className="bg-white rounded-lg shadow-md p-6 group">
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                      </summary>
                      <div className="mt-4 text-gray-600 leading-relaxed">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
                <div className="text-center mt-8">
                  <Link
                    to="/faq"
                    className="inline-flex items-center text-blue-700 font-semibold hover:text-blue-800 transition-colors"
                  >
                    View All FAQs
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="py-10 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
                Explore More
              </p>
              <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <Link
                  to="/services/tv-mounting"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                >
                  <div>
                    <p className="text-blue-900 font-semibold text-sm">Professional TV Mounting</p>
                    <p className="text-blue-700 text-xs mt-0.5">All sizes, wall types &amp; cable management</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </Link>
                <Link
                  to="/gallery"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                >
                  <div>
                    <p className="text-blue-900 font-semibold text-sm">See Our Completed Projects</p>
                    <p className="text-blue-700 text-xs mt-0.5">Browse our furniture assembly gallery</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </Link>
                <Link
                  to="/about"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                >
                  <div>
                    <p className="text-blue-900 font-semibold text-sm">About Our Team</p>
                    <p className="text-blue-700 text-xs mt-0.5">Meet the experts behind Boxed2Built</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </Link>
                <Link
                  to="/gift-cards"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                >
                  <div>
                    <p className="text-blue-900 font-semibold text-sm">Gift Cards Available</p>
                    <p className="text-blue-700 text-xs mt-0.5">Give the gift of professional assembly</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Ready to Get Started?
              </h2>
              <p className="text-xl mb-8 text-blue-100">
                Skip the frustration of DIY assembly. Let our professionals handle your furniture assembly in Spring Hill, TN. Free quotes, flexible scheduling, and satisfaction guaranteed.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton
                  size="lg"
                  pageSection="furniture_assembly_cta"
                  className="bg-white text-blue-700 hover:bg-gray-100 hover:text-blue-800"
                />
                <Link
                  to="/contact"
                  onClick={() => handleContactClick('cta_quote')}
                  className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors border-2 border-white"
                >
                  Request a Quote
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default FurnitureAssemblyPage;
