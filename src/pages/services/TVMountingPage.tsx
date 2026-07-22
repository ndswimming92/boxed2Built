import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Shield, Wrench, Home, ArrowRight, Monitor, Zap } from 'lucide-react';
import EnhancedLocalBusinessSchema from '../../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../../components/seo/FAQSchema';
import BreadcrumbSchema from '../../components/seo/BreadcrumbSchema';
import ServiceSchema from '../../components/seo/ServiceSchema';
import ImageLightbox, { LightboxImage } from '../../components/ui/ImageLightbox';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import CallButton from '../../components/ui/CallButton';
import Testimonials from '../../components/sections/Testimonials';
import { trackEvent } from '../../utils/analytics';
import { Head } from 'vite-react-ssg';
import { formatPhoneForDisplay } from '../../services/communicationService';
import { LOCAL_SEO_CONTENT, FAQ_CONTENT, SERVICE_AREAS } from '../../constants/localSEO';
import { useBusinessLoaderData } from '../../hooks/useBusinessLoaderData';

const TV_MOUNTING_SERVICES = [
  {
    name: "Small TV Mounting (32\"-43\")",
    description: "Perfect for bedrooms and small spaces. Includes wall mount, installation, and cable management.",
    price: "125"
  },
  {
    name: "Medium TV Mounting (44\"-55\")",
    description: "Ideal for living rooms and dens. Professional installation with optimal viewing angle setup.",
    price: "165"
  },
  {
    name: "Large TV Mounting (56\"-65\")",
    description: "Full-motion mount options available. Expert installation ensuring secure placement.",
    price: "225"
  },
  {
    name: "Extra Large TV Mounting (66\"+)",
    description: "Premium mounting for large displays. Includes stud finding and reinforced mounting.",
    price: "295"
  }
];

const TVMountingPage: React.FC = () => {
  const businessData = useBusinessLoaderData();
  const phoneDisplay = formatPhoneForDisplay((businessData?.info?.phone || '+16154034538').replace(/^\+1/, ''));

  const commonQuestions = FAQ_CONTENT.find(cat => cat.category === "Common Questions")?.questions || [];
  const servicesAndPricing = FAQ_CONTENT.find(cat => cat.category === "Services & Pricing")?.questions || [];

  const tvMountingFAQs = [
    {
      question: "Do you provide the TV mounting bracket?",
      answer: "We can install your existing bracket or recommend the best bracket for your TV size and wall type. We work with all major bracket brands and types including fixed, tilting, and full-motion mounts."
    },
    {
      question: "Can you mount a TV on any wall type?",
      answer: "Yes! We have experience mounting TVs on drywall, brick, concrete, plaster, and stone walls. We use appropriate hardware and techniques for each wall type to ensure a secure installation."
    },
    {
      question: "How long does TV mounting take?",
      answer: "Most TV installations take 1-2 hours depending on the size of the TV, wall type, and cable management requirements. We'll provide a more specific timeframe when you schedule."
    },
    {
      question: "Do you hide the cables?",
      answer: "Yes! We offer professional cable management including in-wall wire concealment where possible, or neat cable channels to keep your installation looking clean and professional."
    },
    commonQuestions[2],
    servicesAndPricing[0],
  ].filter(Boolean);

  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  const handleContactClick = (source: string) => {
    trackEvent('contact_click', source, {
      event_category: 'contact',
      event_label: `${source}_tv_mounting`,
      page_section: 'tv_mounting_page',
    });
  };

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.tvMounting.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.tvMounting.description} />
        <link rel="canonical" href="https://boxed2built.com/services/tv-mounting" />
        <meta property="og:url" content="https://boxed2built.com/services/tv-mounting" />
        <meta property="og:title" content="TV Mounting in Spring Hill, TN | Boxed2Built" />
        <meta property="og:description" content="Professional TV mounting in Spring Hill, TN. Secure installation, clean cable management, satisfaction guaranteed." />
        <meta name="twitter:title" content="TV Mounting | Boxed2Built Spring Hill, TN" />
        <meta name="twitter:description" content="Book professional TV mounting in Spring Hill, TN — secure install, clean cables, polished finish." />
      </Head>
      <EnhancedLocalBusinessSchema businessData={businessData} />
      <FAQSchema faqs={tvMountingFAQs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: 'https://boxed2built.com/' },
        { name: 'Services', url: 'https://boxed2built.com/services' },
        { name: 'TV Mounting', url: 'https://boxed2built.com/services/tv-mounting' },
      ]} />
      <ServiceSchema
        name="TV Mounting Service"
        description="Professional TV mounting for all sizes and wall types in Spring Hill, TN. Secure installation with cable management and optimal viewing angle setup. Same-day service available."
        url="https://boxed2built.com/services/tv-mounting"
        serviceType="TV Mounting"
        offers={TV_MOUNTING_SERVICES}
      />
      <Header />

      <main className="min-h-screen">
        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-32 pb-16">
          <div className="container mx-auto px-4">
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Services', href: '/services' },
                { label: 'TV Mounting', href: '/services/tv-mounting' }
              ]}
            />

            <div className="max-w-4xl mx-auto text-center mt-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Professional TV Mounting Service in Spring Hill, TN
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed">
                Expert TV installation for all sizes and wall types. Safe, secure mounting with cable management included. Same-day service available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton size="lg" pageSection="tv_mounting_hero" />
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
          </div>
        </div>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                Why Choose Boxed2Built for TV Mounting?
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  {
                    icon: CheckCircle2,
                    title: 'Expert Installation',
                    description: 'Professional TV mounting for all brands and sizes. We ensure your TV is securely mounted with proper viewing angles.'
                  },
                  {
                    icon: Wrench,
                    title: 'All Wall Types',
                    description: 'Experience with drywall, brick, concrete, and plaster. We use the right hardware for your specific wall type.'
                  },
                  {
                    icon: Zap,
                    title: 'Cable Management',
                    description: 'Clean, professional wire concealment. In-wall routing or decorative cable channels available.'
                  },
                  {
                    icon: Shield,
                    title: 'Safety Guaranteed',
                    description: 'Your TV is securely mounted using professional techniques and quality hardware. Satisfaction guaranteed.'
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
                TV Mounting Services & Pricing
              </h2>
              <p className="text-lg text-gray-700 mb-12 text-center">
                Transparent pricing with no hidden fees. All services include professional installation, proper mounting hardware, and basic cable management.
              </p>
              <div className="grid gap-6">
                {TV_MOUNTING_SERVICES.map((service, index) => (
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
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Services Available:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-blue-700 mr-2 flex-shrink-0 mt-0.5" />
                    <span>In-wall cable concealment and wire routing</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-blue-700 mr-2 flex-shrink-0 mt-0.5" />
                    <span>TV stand assembly and setup</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-blue-700 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Sound bar and component mounting</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-blue-700 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Old TV removal and recycling coordination</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8 text-center">
                <p className="text-gray-600 mb-4">Need multiple TVs mounted? Ask about our multi-room discounts.</p>
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
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                Our TV Mounting Process
              </h2>
              <div className="space-y-8">
                {[
                  {
                    step: '1',
                    title: 'Schedule Your Installation',
                    description: `Call us at ${phoneDisplay} or book online. We offer flexible scheduling including same-day service when available.`
                  },
                  {
                    step: '2',
                    title: 'Pre-Installation Consultation',
                    description: "We assess your wall type, TV size, and mounting preferences. We'll recommend the best mounting solution for your space."
                  },
                  {
                    step: '3',
                    title: 'Professional Mounting',
                    description: 'Using professional tools and techniques, we securely mount your TV at the optimal viewing height and angle for your room.'
                  },
                  {
                    step: '4',
                    title: 'Cable Management',
                    description: 'We organize and conceal cables for a clean, professional appearance. In-wall routing available when requested.'
                  },
                  {
                    step: '5',
                    title: 'Testing & Cleanup',
                    description: 'We test the mount stability, adjust viewing angles, and clean up completely. Your TV is ready to enjoy immediately.'
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
            </div>
          </div>
        </section>

        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                TV Brands We Install
              </h2>
              <p className="text-xl text-center mb-12">
                We have experience mounting all major TV brands and models. If you have a TV, we can mount it professionally and securely!
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
                {[
                  'Samsung',
                  'LG',
                  'Sony',
                  'TCL',
                  'Vizio',
                  'Hisense',
                  'Roku TV',
                  'Fire TV',
                  'Sharp',
                  'Toshiba',
                  'Insignia',
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
                <Monitor className="w-10 h-10 text-blue-700 mr-3" />
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Mount Types We Install
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    type: 'Fixed Mount',
                    description: 'Slim, low-profile mounting for a clean look. Perfect for walls where you want the TV flush against the surface.',
                    ideal: 'Best for rooms with fixed seating'
                  },
                  {
                    type: 'Tilting Mount',
                    description: 'Allows up and down angle adjustment. Great for reducing glare and mounting TVs above eye level.',
                    ideal: 'Ideal for bedrooms and high placements'
                  },
                  {
                    type: 'Full-Motion Mount',
                    description: 'Maximum flexibility with swivel and tilt. Pull TV away from wall and adjust viewing angle from anywhere in the room.',
                    ideal: 'Perfect for corner installations'
                  }
                ].map((mount, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">{mount.type}</h3>
                    <p className="text-gray-600 mb-4">{mount.description}</p>
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-blue-700 font-medium">{mount.ideal}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
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
                  <div key={index} className="bg-gray-50 rounded-lg shadow p-4 text-gray-700 font-medium">
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

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <Testimonials />
          </div>
        </section>

        {tvMountingFAQs.length > 0 && (
          <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                  Frequently Asked Questions
                </h2>
                <div className="space-y-6">
                  {tvMountingFAQs.map((faq, index) => (
                    <details key={index} className="bg-gray-50 rounded-lg shadow-md p-6 group">
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
                  to="/services/furniture-assembly"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                >
                  <div>
                    <p className="text-blue-900 font-semibold text-sm">Professional Furniture Assembly</p>
                    <p className="text-blue-700 text-xs mt-0.5">IKEA, Target, Walmart &amp; all major brands</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                </Link>
                <Link
                  to="/gallery"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                >
                  <div>
                    <p className="text-blue-900 font-semibold text-sm">See Our Completed Projects</p>
                    <p className="text-blue-700 text-xs mt-0.5">Browse our TV mounting and assembly gallery</p>
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
                    <p className="text-blue-700 text-xs mt-0.5">Give the gift of professional installation</p>
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
                Ready to Mount Your TV?
              </h2>
              <p className="text-xl mb-8 text-blue-100">
                Let our professionals handle your TV mounting in Spring Hill, TN. Safe, secure installation with cable management included. Same-day service available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton
                  size="lg"
                  pageSection="tv_mounting_cta"
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
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
};

export default TVMountingPage;
