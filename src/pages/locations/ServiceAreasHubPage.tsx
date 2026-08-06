import React from 'react';
import { Link } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { ArrowRight, MapPin, Clock, ShieldCheck } from 'lucide-react';
import EnhancedLocalBusinessSchema from '../../components/seo/EnhancedLocalBusinessSchema';
import BreadcrumbSchema from '../../components/seo/BreadcrumbSchema';
import FAQSchema from '../../components/seo/FAQSchema';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import CallButton from '../../components/ui/CallButton';
import { useBusinessLoaderData } from '../../hooks/useBusinessLoaderData';
import {
  LOCATION_HUB_META,
  SERVICE_LOCATIONS,
  SITE_URL,
  locationLabel,
  locationPath,
  locationUrl,
} from '../../constants/serviceLocations';

const HUB_FAQS = [
  {
    question: 'What areas does Boxed2Built serve?',
    answer:
      'We are based in Spring Hill, TN and serve Spring Hill, Thompson’s Station, Franklin, Brentwood, Nolensville, Columbia, Mount Pleasant, Chapel Hill and Nashville — covering Williamson County, Maury County, Marshall County and the Nashville metro. Every one of these is inside our standard service area with no travel fee.',
  },
  {
    question: 'Is there a travel fee for my location?',
    answer:
      'Not within our standard service area, which covers all nine cities listed on this page. For addresses further out we may apply a modest travel charge, but we will always quote it up front before you book — never as a surprise on the invoice.',
  },
  {
    question: 'My town is not listed. Can you still come out?',
    answer:
      'Quite possibly. The nine cities here are where we work most often, not a hard boundary, and plenty of Middle Tennessee addresses sit between them. Send us your address and we will tell you honestly whether we can cover it and whether any travel charge applies.',
  },
  {
    question: 'Do you charge more in some cities than others?',
    answer:
      'No. Our per-item pricing is identical everywhere we work. A bed frame costs the same in Brentwood as it does in Columbia. What changes between towns is the type of work people book, not the rate.',
  },
];

const ServiceAreasHubPage: React.FC = () => {
  const businessData = useBusinessLoaderData();
  const canonical = `${SITE_URL}/service-areas`;

  const homeBase = SERVICE_LOCATIONS.filter((location) => location.isHomeBase);
  const otherAreas = SERVICE_LOCATIONS.filter((location) => !location.isHomeBase);

  return (
    <>
      <Head>
        <title>{LOCATION_HUB_META.title}</title>
        <meta name="description" content={LOCATION_HUB_META.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={LOCATION_HUB_META.title} />
        <meta property="og:description" content={LOCATION_HUB_META.description} />
        <meta name="twitter:title" content={LOCATION_HUB_META.title} />
        <meta name="twitter:description" content={LOCATION_HUB_META.description} />
      </Head>

      <EnhancedLocalBusinessSchema businessData={businessData} />
      <FAQSchema faqs={HUB_FAQS} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Service Areas', url: canonical },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Boxed2Built Service Areas',
            description:
              'Cities served by Boxed2Built for furniture assembly and TV mounting across Middle Tennessee.',
            itemListElement: SERVICE_LOCATIONS.map((location, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: `Furniture Assembly in ${locationLabel(location)}`,
              url: locationUrl(location.slug),
            })),
          }),
        }}
      />

      <Header />

      <main className="min-h-screen">
        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-32 pb-16">
          <div className="container mx-auto px-4">
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Service Areas', href: '/service-areas', current: true },
              ]}
            />
            <div className="max-w-4xl mx-auto text-center mt-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Furniture Assembly Service Areas in Middle Tennessee
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed">
                Based in Spring Hill, serving nine cities across Williamson, Maury and Marshall
                counties and the Nashville metro — with no travel fee inside our standard area.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton size="lg" pageSection="service_areas_hub_hero" />
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-md border-2 border-blue-700"
                >
                  Check Your Address
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {homeBase.length > 0 && (
          <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                {homeBase.map((location) => (
                  <Link
                    key={location.slug}
                    to={locationPath(location.slug)}
                    className="group block bg-gradient-to-br from-blue-700 to-blue-900 text-white rounded-2xl p-8 md:p-10 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <p className="inline-flex items-center gap-2 text-sm font-semibold bg-white/15 rounded-full px-4 py-1.5 mb-5">
                      <MapPin className="w-4 h-4" />
                      Our home base
                    </p>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                      {locationLabel(location)}
                    </h2>
                    <p className="text-blue-100 text-lg leading-relaxed mb-6">
                      {location.heroSubtitle}
                    </p>
                    <span className="inline-flex items-center font-semibold">
                      Explore {location.city} furniture assembly
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                Cities We Serve
              </h2>
              <p className="text-lg text-gray-700 mb-12 text-center max-w-2xl mx-auto">
                Each city has its own page with local pricing detail, the neighborhoods we cover
                and answers to the questions people there actually ask.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherAreas.map((location) => (
                  <Link
                    key={location.slug}
                    to={locationPath(location.slug)}
                    className="group bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-800">
                        {locationLabel(location)}
                      </h3>
                      <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{location.county}</p>
                    <p className="text-gray-600 text-sm leading-relaxed flex-1">
                      {location.heroSubtitle}
                    </p>
                    <p className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {location.driveTime}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      ZIP {location.zipCodes.slice(0, 4).join(', ')}
                      {location.zipCodes.length > 4 ? ' and more' : ''}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                The Same Deal Everywhere We Work
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    icon: MapPin,
                    title: 'No travel fee',
                    description:
                      'Every city on this page is inside our standard service area. The quote you get is the price you pay — travel is not a line item.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Identical pricing',
                    description:
                      'A bed frame costs the same in Brentwood as in Columbia. We do not price by ZIP code, and we publish our rates openly.',
                  },
                  {
                    icon: Clock,
                    title: 'Flexible scheduling',
                    description:
                      'Weekday and Saturday appointments, a 30-minute courtesy call before arrival, and no charge to reschedule when a delivery slips.',
                  },
                ].map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                      <item.icon className="w-8 h-8 text-blue-700" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
                Service Area Questions
              </h2>
              <div className="space-y-6">
                {HUB_FAQS.map((faq, index) => (
                  <details key={index} className="bg-white rounded-lg shadow-md p-6 group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                    </summary>
                    <div className="mt-4 text-gray-600 leading-relaxed">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Not Sure If We Cover You?</h2>
              <p className="text-xl mb-8 text-blue-100">
                Send us your address. We will tell you straight away whether it is inside our
                standard area and what the job would cost.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CallButton
                  size="lg"
                  pageSection="service_areas_hub_cta"
                  className="bg-white text-blue-700 hover:bg-gray-100 hover:text-blue-800"
                />
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors border-2 border-white"
                >
                  Contact Us
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

export default ServiceAreasHubPage;
