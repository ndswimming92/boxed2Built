import React from 'react';
import { Link } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import EnhancedLocalBusinessSchema from '../../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../../components/seo/FAQSchema';
import BreadcrumbSchema from '../../components/seo/BreadcrumbSchema';
import ServiceSchema from '../../components/seo/ServiceSchema';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import CallButton from '../../components/ui/CallButton';
import Testimonials from '../../components/sections/Testimonials';
import { trackEvent } from '../../utils/analytics';
import { formatPhoneForDisplay } from '../../services/communicationService';
import { useBusinessLoaderData } from '../../hooks/useBusinessLoaderData';
import type { ServiceLandingContent } from '../../constants/serviceLandingPages';
import { serviceLandingPath } from '../../constants/serviceLandingPages';
import {
  SERVICE_LOCATIONS,
  SITE_URL,
  locationLabel,
  locationPath,
} from '../../constants/serviceLocations';

interface ServiceLandingPageProps {
  content: ServiceLandingContent;
}

const ServiceLandingPage: React.FC<ServiceLandingPageProps> = ({ content }) => {
  const businessData = useBusinessLoaderData();
  const phoneDisplay = formatPhoneForDisplay(
    (businessData?.info?.phone || '+16154034538').replace(/^\+1/, ''),
  );

  const path = serviceLandingPath(content.slug);
  const canonical = `${SITE_URL}${path}`;

  // Only the tiers with a real dollar figure belong in Offer schema — quoted
  // work has no price to state, and inventing one would misrepresent it.
  const schemaOffers = content.pricing
    .filter((tier): tier is typeof tier & { price: string } => Boolean(tier.price))
    .map((tier) => ({
      name: tier.name,
      description: tier.description,
      price: tier.price,
    }));

  const handleContactClick = (source: string) => {
    trackEvent('contact_click', source, {
      event_category: 'contact',
      event_label: `${source}_${content.slug}`,
      page_section: `${content.slug}_page`,
    });
  };

  return (
    <>
      <Head>
        <title>{content.metaTitle}</title>
        <meta name="description" content={content.metaDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={content.ogTitle} />
        <meta property="og:description" content={content.ogDescription} />
        <meta name="twitter:title" content={content.ogTitle} />
        <meta name="twitter:description" content={content.ogDescription} />
      </Head>

      <EnhancedLocalBusinessSchema businessData={businessData} />
      <FAQSchema faqs={content.faqs} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Services', url: `${SITE_URL}/services` },
          { name: content.breadcrumbLabel, url: canonical },
        ]}
      />
      <ServiceSchema
        name={content.schemaName}
        description={content.schemaDescription}
        url={canonical}
        serviceType={content.serviceType}
        offers={schemaOffers}
        areaServed={SERVICE_LOCATIONS.map((location) => locationLabel(location))}
      />

      <Header />

      <main className="min-h-screen">
        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-32 pb-16">
          <div className="container mx-auto px-4">
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Services', href: '/services' },
                { label: content.breadcrumbLabel, href: path, current: true },
              ]}
            />

            <div className="max-w-4xl mx-auto text-center mt-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                {content.h1}
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed">
                {content.heroSubtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton size="lg" pageSection={`${content.slug}_hero`} />
                <Link
                  to="/contact"
                  onClick={() => handleContactClick('hero_quote')}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-md border-2 border-blue-700"
                >
                  Get a Free Quote
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              {content.intro.map((paragraph, index) => (
                <p key={index} className="text-lg text-gray-700 leading-relaxed mb-6">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                What You Get
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {content.highlights.map((highlight, index) => (
                  <div key={index} className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                      <Sparkles className="w-8 h-8 text-blue-700" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{highlight.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{highlight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
                {content.pricingHeading}
              </h2>
              <p className="text-lg text-gray-700 mb-12 text-center">{content.pricingIntro}</p>
              <div className="grid gap-6">
                {content.pricing.map((tier, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{tier.name}</h3>
                        <p className="text-gray-600">{tier.description}</p>
                      </div>
                      <div className="mt-4 sm:mt-0 sm:ml-6 sm:text-right sm:min-w-[9rem]">
                        {tier.price ? (
                          <>
                            <div className="text-sm text-gray-500 mb-1">starting at</div>
                            <div className="text-3xl font-bold text-blue-700">${tier.price}</div>
                          </>
                        ) : (
                          <div className="text-base font-semibold text-blue-700">
                            {tier.priceNote}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Included with every job:
                </h3>
                <ul className="space-y-2 text-gray-700">
                  {content.alsoIncluded.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-blue-700 mr-2 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 text-center">
                <p className="text-gray-600 mb-4">
                  Not sure which tier fits? Call or text {phoneDisplay} and we will quote your
                  exact list.
                </p>
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

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                {content.processHeading}
              </h2>
              <div className="space-y-8">
                {content.process.map((step, index) => (
                  <div key={index} className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-700 text-white rounded-full flex items-center justify-center text-xl font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{step.description}</p>
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
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
                {content.showcase.heading}
              </h2>
              <p className="text-lg text-center text-blue-100 mb-12">{content.showcase.intro}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-center">
                {content.showcase.items.map((item, index) => (
                  <div key={index} className="bg-blue-600 rounded-lg p-4 font-semibold text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                Where We Provide This Service
              </h2>
              <p className="text-lg text-gray-700 mb-10 text-center">
                Same pricing in all nine cities, with no travel fee inside our standard area.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {SERVICE_LOCATIONS.map((location) => (
                  <Link
                    key={location.slug}
                    to={locationPath(location.slug)}
                    className="bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg px-4 py-3 text-gray-700 hover:text-blue-800 text-sm font-medium text-center transition-colors"
                  >
                    {locationLabel(location)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <Testimonials />
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                {content.faqs.map((faq, index) => (
                  <details key={index} className="bg-gray-50 rounded-lg shadow-md p-6 group">
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
                  View All FAQs
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
                Explore More
              </p>
              <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {content.related.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                  >
                    <div>
                      <p className="text-blue-900 font-semibold text-sm">{link.title}</p>
                      <p className="text-blue-700 text-xs mt-0.5">{link.subtitle}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-3" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
              <p className="text-xl mb-8 text-blue-100">
                Free quotes, transparent pricing, all packaging removed, and payment only once you
                are happy with the work.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton
                  size="lg"
                  pageSection={`${content.slug}_cta`}
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

export default ServiceLandingPage;
