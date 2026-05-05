import React from 'react';
import { Gift, ArrowRight } from 'lucide-react';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../components/seo/FAQSchema';
import ServiceAreaSchema from '../components/seo/ServiceAreaSchema';
import Header from '../components/layout/Header';
import HomeHero from '../components/sections/HomeHero';
import HomeServices from '../components/sections/HomeServices';
import HomeFAQ from '../components/sections/HomeFAQ';
import ContactForm from '../components/ContactForm';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import Pricing from '../components/sections/Pricing';
import ReferralProgram from '../components/sections/ReferralProgram';
import HoursGivenBackCounter from '../components/sections/HoursGivenBackCounter';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  LOCAL_SEO_CONTENT,
  FAQ_CONTENT
} from '../constants/localSEO';

const HomePage: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  usePageMeta({
    title: LOCAL_SEO_CONTENT.homepage.title,
    description: LOCAL_SEO_CONTENT.homepage.description,
    canonicalUrl: 'https://boxed2built.com/',
    ogTitle: 'Spring Hill Furniture Assembly | Boxed2Built',
    ogDescription: 'Fast, reliable furniture assembly in Spring Hill, TN for IKEA, Target, Walmart, and more. Get a free quote from Boxed2Built.',
    twitterTitle: 'Spring Hill Furniture Assembly | Boxed2Built',
    twitterDescription: 'Need furniture assembled in Spring Hill, TN? Boxed2Built provides professional setup and cleanup for every build.',
  });

  // Get high-value FAQ questions from Common Questions category plus a few popular ones
  const commonQuestions = FAQ_CONTENT.find(cat => cat.category === "Common Questions")?.questions || [];
  const generalQuestions = FAQ_CONTENT.find(cat => cat.category === "General Information")?.questions || [];

  const homepageFAQs = [
    ...commonQuestions, // All 4 high-value SEO questions
    generalQuestions[0], // What is Boxed2Built?
    {
      question: "How much does furniture assembly cost in Spring Hill, TN?",
      answer: "Our furniture assembly prices start at $85 for small items like chairs, $185 for tables and desks, $220 for storage and shelving, $320 for dressers, and $295 for bed frames. All prices include assembly, cleanup, and placement."
    }
  ];

  if (loading || !businessData) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }


  return (
    <>
      <EnhancedLocalBusinessSchema
        businessData={businessData}
        includeReviews={true}
        pageType="home"
      />
      <FAQSchema faqs={homepageFAQs} />
      <ServiceAreaSchema
        businessName={businessData.info.name}
        businessUrl={businessData.info.website}
        serviceAreas={businessData.serviceAreas}
      />
      <Header />
      <main className="pt-16">
        <HomeHero />

        <HoursGivenBackCounter totalHoursSaved={Number(businessData.info.total_client_hours_saved) || 0} />

        <section id="contact-form-section" className="scroll-mt-24 py-12 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  Get Your Free Quote Today
                </h2>
                <p className="text-xl text-gray-600">
                  Tell us about your furniture assembly needs and we'll respond within 24 hours with a personalized quote. No obligation, completely free.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-gray-200">
                <ContactForm />
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                <span className="inline-block mr-2">✓</span> Average response time: 2-4 hours
                <span className="inline-block mx-4">•</span>
                <span className="inline-block mr-2">✓</span> Serving Spring Hill, Columbia, Franklin & surrounding areas
              </p>

              <div className="text-center mt-6">
                <a href="/faq#build-day-process" className="text-blue-700 hover:text-blue-800 underline font-medium text-base">
                  Learn about our assembly process and what to expect on build day →
                </a>
              </div>
            </div>
          </div>
        </section>

        <HomeServices />

        <Testimonials />

        <ReferralProgram />

        <section className="py-16 bg-gradient-to-br from-emerald-50 via-white to-blue-50">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
              <div className="grid md:grid-cols-[1.1fr_1fr] items-center">
                <div className="p-8 md:p-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold tracking-wide uppercase mb-4">
                    <Gift size={14} />
                    Gift Cards
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-3">
                    Give the gift of a finished room.
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    A Boxed2Built gift card covers professional furniture assembly for friends, family, or
                    clients. Pick a fixed amount, send it instantly by email, and the balance never expires —
                    partial amounts roll over across jobs.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="/gift-cards"
                      className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-md hover:shadow-lg transition"
                    >
                      Buy a Gift Card
                      <ArrowRight size={18} className="ml-2" />
                    </a>
                    <a
                      href="/redeem-gift-card"
                      className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:border-emerald-500 hover:text-emerald-800 hover:bg-emerald-50 transition"
                    >
                      Check a Balance
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    $25, $50, $100, or $200 denominations. Delivered instantly by email.
                  </p>
                </div>
                <div className="relative bg-gradient-to-br from-emerald-600 to-blue-700 p-8 md:p-10 min-h-[260px] flex items-center justify-center">
                  <div className="w-full max-w-xs rotate-[-4deg] rounded-2xl bg-white/10 backdrop-blur border border-white/30 p-6 text-white shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-xs font-semibold uppercase tracking-widest opacity-90">
                        Boxed2Built
                      </span>
                      <Gift size={22} className="opacity-90" />
                    </div>
                    <div className="text-4xl font-bold mb-1">$100</div>
                    <div className="text-xs opacity-80 mb-6">Service credit</div>
                    <div className="font-mono text-sm tracking-wider opacity-90">
                      B2B-XXXX-XXXX
                    </div>
                    <div className="mt-4 text-[11px] opacity-75">Never expires</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Pricing />

        <HomeFAQ
          faqs={homepageFAQs}
          title="Frequently Asked Questions"
          subtitle="Get answers to the most common questions about furniture assembly in Spring Hill, TN"
          showViewAllLink={true}
        />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;
