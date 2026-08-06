import React from 'react';
import { Link } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Home as HomeIcon,
  MapPin,
  Sparkles,
} from 'lucide-react';
import EnhancedLocalBusinessSchema from '../../components/seo/EnhancedLocalBusinessSchema';
import LocationServiceSchema from '../../components/seo/LocationServiceSchema';
import FAQSchema from '../../components/seo/FAQSchema';
import BreadcrumbSchema from '../../components/seo/BreadcrumbSchema';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import CallButton from '../../components/ui/CallButton';
import Testimonials from '../../components/sections/Testimonials';
import { trackEvent } from '../../utils/analytics';
import { formatPhoneForDisplay } from '../../services/communicationService';
import { useBusinessLoaderData } from '../../hooks/useBusinessLoaderData';
import { PRIMARY_SERVICES } from '../../constants/localSEO';
import {
  SITE_URL,
  type ServiceLocation,
  getNearbyLocations,
  locationLabel,
  locationPath,
  locationUrl,
} from '../../constants/serviceLocations';
import { SERVICE_LANDING_PAGES } from '../../constants/serviceLandingPages';

interface ServiceAreaPageProps {
  location: ServiceLocation;
}

const CORE_SERVICE_LINKS = [
  {
    href: '/services/furniture-assembly',
    title: 'Furniture Assembly',
    subtitle: 'IKEA, Wayfair, Target, Walmart, Amazon and every other flat-pack brand.',
  },
  {
    href: '/services/tv-mounting',
    title: 'TV Mounting',
    subtitle: 'Secure installation on drywall, plaster, brick and stone, with cable management.',
  },
  ...SERVICE_LANDING_PAGES.map((page) => ({
    href: `/services/${page.slug}`,
    title: page.navLabel,
    subtitle: page.navDescription,
  })),
];

const ServiceAreaPage: React.FC<ServiceAreaPageProps> = ({ location }) => {
  const businessData = useBusinessLoaderData();
  const phoneDisplay = formatPhoneForDisplay(
    (businessData?.info?.phone || '+16154034538').replace(/^\+1/, ''),
  );

  const label = locationLabel(location);
  const canonical = locationUrl(location.slug);
  const nearby = getNearbyLocations(location);

  const handleContactClick = (source: string) => {
    trackEvent('contact_click', source, {
      event_category: 'contact',
      event_label: `${source}_${location.slug}`,
      page_section: 'service_area_page',
    });
  };

  return (
    <>
      <Head>
        <title>{location.metaTitle}</title>
        <meta name="description" content={location.metaDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={location.metaTitle} />
        <meta property="og:description" content={location.metaDescription} />
        <meta name="twitter:title" content={location.metaTitle} />
        <meta name="twitter:description" content={location.metaDescription} />
      </Head>

      <EnhancedLocalBusinessSchema businessData={businessData} />
      <LocationServiceSchema
        location={location}
        offers={PRIMARY_SERVICES.map((service) => ({
          name: service.name,
          description: service.description,
          price: service.price,
        }))}
      />
      <FAQSchema faqs={location.faqs} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Service Areas', url: `${SITE_URL}/service-areas` },
          { name: label, url: canonical },
        ]}
      />

      <Header />

      <main className="min-h-screen">
        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-32 pb-16">
          <div className="container mx-auto px-4">
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Service Areas', href: '/service-areas' },
                { label: label, href: locationPath(location.slug), current: true },
              ]}
            />

            <div className="max-w-4xl mx-auto text-center mt-8">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800 bg-blue-100 rounded-full px-4 py-1.5 mb-6">
                <MapPin className="w-4 h-4" />
                {location.county}
                {location.isHomeBase && ' · Our home base'}
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                {location.h1}
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed">
                {location.heroSubtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton size="lg" pageSection={`service_area_hero_${location.slug}`} />
                <Link
                  to="/contact"
                  onClick={() => handleContactClick('hero_quote')}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-md border-2 border-blue-700"
                >
                  Get a Free Quote
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
              <p className="mt-6 text-sm text-gray-600 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-blue-700" />
                {location.driveTime}
              </p>
            </div>
          </div>
        </div>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
                Furniture Assembly for {label} Homes
              </h2>
              {location.intro.map((paragraph, index) => (
                <p key={index} className="text-lg text-gray-700 leading-relaxed mb-6">
                  {paragraph}
                </p>
              ))}
              <p className="text-base text-gray-600">
                Serving ZIP {location.zipCodes.length > 1 ? 'codes' : 'code'}{' '}
                <span className="font-semibold text-gray-800">
                  {location.zipCodes.join(', ')}
                </span>{' '}
                and the surrounding {location.county} area. Call or text{' '}
                <a
                  href={`tel:${businessData?.info?.phone || '+16154034538'}`}
                  className="text-blue-700 font-semibold hover:text-blue-800"
                >
                  {phoneDisplay}
                </a>{' '}
                for a free quote.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                Why {location.city} Homeowners Call Us
              </h2>
              <p className="text-lg text-gray-700 mb-12 text-center max-w-2xl mx-auto">
                Every town we serve has its own housing stock and its own quirks. Here is what
                that means in {location.city}.
              </p>
              <div className="grid md:grid-cols-3 gap-8">
                {location.highlights.map((highlight, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md p-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                      <Sparkles className="w-6 h-6 text-blue-700" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {highlight.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">{highlight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                Services We Provide in {location.city}
              </h2>
              <p className="text-lg text-gray-700 mb-12 text-center max-w-2xl mx-auto">
                Same transparent pricing everywhere we work — no {location.city} surcharge and no
                travel fee.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {CORE_SERVICE_LINKS.map((service) => (
                  <Link
                    key={service.href}
                    to={service.href}
                    onClick={() => handleContactClick(`service_${service.href}`)}
                    className="group bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg p-6 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-800">
                        {service.title}
                      </h3>
                      <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                      {service.subtitle}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">
                Most Requested in {location.city}
              </h2>
              <p className="text-lg text-blue-100 mb-10 text-center max-w-2xl mx-auto">
                The jobs that fill our {location.city} calendar most weeks.
              </p>
              <ul className="grid md:grid-cols-2 gap-4">
                {location.popularServices.map((service, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 bg-blue-600/60 rounded-lg px-5 py-4"
                  >
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-100" />
                    <span className="leading-relaxed">{service}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center mb-4">
                <HomeIcon className="w-9 h-9 text-blue-700 mr-3" />
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  {location.city} Neighborhoods We Serve
                </h2>
              </div>
              <p className="text-lg text-gray-700 mb-10 text-center">
                We work throughout {label} — these come up most often, but the list is not
                exhaustive. If you are nearby and not listed, just ask.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {location.neighborhoods.map((neighborhood, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg shadow-sm px-4 py-3 text-gray-700 text-sm font-medium text-center"
                  >
                    {neighborhood}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <Testimonials />
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                {location.city} Furniture Assembly FAQs
              </h2>
              <div className="space-y-6">
                {location.faqs.map((faq, index) => (
                  <details key={index} className="bg-white rounded-lg shadow-md p-6 group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                    </summary>
                    <div className="mt-4 text-gray-600 leading-relaxed">{faq.answer}</div>
                  </details>
                ))}
              </div>
              <div className="text-center mt-8">
                <Link
                  to="/faq"
                  className="inline-flex items-center text-blue-700 font-semibold hover:text-blue-800 transition-colors"
                >
                  View all frequently asked questions
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {nearby.length > 0 && (
          <section className="py-14 bg-white border-t border-gray-100">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center">
                  Nearby Areas We Also Serve
                </h2>
                <p className="text-gray-600 text-center mb-8">
                  Not quite in {location.city}? We cover these neighboring communities too.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {nearby.map((nearbyLocation) => (
                    <Link
                      key={nearbyLocation.slug}
                      to={locationPath(nearbyLocation.slug)}
                      className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                    >
                      <div>
                        <p className="text-blue-900 font-semibold text-sm">
                          Furniture Assembly in {locationLabel(nearbyLocation)}
                        </p>
                        <p className="text-blue-700 text-xs mt-0.5">{nearbyLocation.county}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                    </Link>
                  ))}
                </div>
                <div className="text-center mt-6">
                  <Link
                    to="/service-areas"
                    className="inline-flex items-center text-blue-700 font-semibold hover:text-blue-800 transition-colors"
                  >
                    See all service areas
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="py-20 bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Got Boxes in {location.city}? We will Build Them.
              </h2>
              <p className="text-xl mb-8 text-blue-100">
                Free quotes, transparent pricing, all packaging removed, and payment only once you
                are happy with the work.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton
                  size="lg"
                  pageSection={`service_area_cta_${location.slug}`}
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

export default ServiceAreaPage;
