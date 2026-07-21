import React, { useState } from 'react';
import { Gift, ArrowRight } from 'lucide-react';
import { useLoaderData } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../components/seo/FAQSchema';
import ServiceAreaSchema from '../components/seo/ServiceAreaSchema';
import Header from '../components/layout/Header';
import BoxLoader from '../components/BoxLoader';
import HomeHero from '../components/sections/HomeHero';
import HomeServices from '../components/sections/HomeServices';
import HomeFAQ from '../components/sections/HomeFAQ';
import ContactForm from '../components/ContactForm';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import Pricing from '../components/sections/Pricing';
import ReferralProgram from '../components/sections/ReferralProgram';
import HoursGivenBackCounter from '../components/sections/HoursGivenBackCounter';
import FormProgressRail from '../components/ui/FormProgressRail';
import { CompleteBusinessData } from '../lib/supabase';
import {
  LOCAL_SEO_CONTENT,
  FAQ_CONTENT
} from '../constants/localSEO';

const HomePage: React.FC = () => {
  const { businessData } = useLoaderData() as { businessData: CompleteBusinessData };
  const [quoteProgress, setQuoteProgress] = useState(0);

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

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.homepage.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.homepage.description} />
        <link rel="canonical" href="https://boxed2built.com/" />
        <meta property="og:url" content="https://boxed2built.com/" />
        <meta property="og:title" content="Spring Hill Furniture Assembly | Boxed2Built" />
        <meta property="og:description" content="Fast, reliable furniture assembly in Spring Hill, TN for IKEA, Target, Walmart, and more. Get a free quote from Boxed2Built." />
        <meta name="twitter:title" content="Spring Hill Furniture Assembly | Boxed2Built" />
        <meta name="twitter:description" content="Need furniture assembled in Spring Hill, TN? Boxed2Built provides professional setup and cleanup for every build." />
      </Head>
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
      <BoxLoader />
      <Header />
      <main className="pt-16">
        <HomeHero />

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

              <div className="relative">
                <FormProgressRail progress={quoteProgress} />
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-gray-200">
                  <ContactForm sideRail onProgressChange={setQuoteProgress} />
                </div>
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

        <HoursGivenBackCounter totalHoursSaved={Number(businessData.info.total_client_hours_saved) || 0} />

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-50 via-white to-emerald-50 border border-blue-100 rounded-2xl shadow-sm p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Why Choose Boxed2Built Instead of a Marketplace App?
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-5">
                Marketplace apps can connect you with available providers, but Boxed2Built gives you a more personal local experience. You work directly with a Spring Hill-based furniture assembly service focused on clear quotes, careful workmanship, and helping busy families enjoy their homes sooner.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-5">
                From flat-pack furniture and TV mounting to nursery setups, patio furniture, garage storage, and move-in projects, Boxed2Built is built around one simple goal:
              </p>
              <p className="text-xl md:text-2xl font-semibold text-gray-900 mb-8">
                Turning boxes into comfort so families can focus on what matters most.
              </p>

              <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm md:text-base">
                    <caption className="sr-only">Boxed2Built vs marketplace app comparison</caption>
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold text-gray-900">What Matters</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-blue-800">Boxed2Built</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Marketplace Apps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <th scope="row" className="px-4 py-3 font-medium text-gray-900">Who you work with</th>
                        <td className="px-4 py-3 text-gray-700">Directly with a local Spring Hill service</td>
                        <td className="px-4 py-3 text-gray-600">Often routed through a platform and rotating providers</td>
                      </tr>
                      <tr>
                        <th scope="row" className="px-4 py-3 font-medium text-gray-900">Quote process</th>
                        <td className="px-4 py-3 text-gray-700">Clear quotes based on your actual items and photos</td>
                        <td className="px-4 py-3 text-gray-600">Generalized pricing tiers and in-app variables</td>
                      </tr>
                      <tr>
                        <th scope="row" className="px-4 py-3 font-medium text-gray-900">Service focus</th>
                        <td className="px-4 py-3 text-gray-700">Furniture assembly, TV mounting, and move-in setups</td>
                        <td className="px-4 py-3 text-gray-600">Broad gig categories with mixed specialization</td>
                      </tr>
                      <tr>
                        <th scope="row" className="px-4 py-3 font-medium text-gray-900">Experience style</th>
                        <td className="px-4 py-3 text-gray-700">Personal communication and careful workmanship</td>
                        <td className="px-4 py-3 text-gray-600">App-based messaging with less continuity</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-7">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
                  Ready for a clear quote without the app-hopping?
                </h3>
                <p className="text-gray-700 leading-relaxed mb-5">
                  Send photos, item links, or a quick description of what you need built, and Boxed2Built will help you figure out the best option.
                </p>
                <a
                  href="https://boxed2built.com/contact?utm_id=B2B&utm_source=website&utm_medium=comparison_section&utm_campaign=local_vs_marketplace&utm_term=furniture_assembly&utm_content=quote_cta"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-md hover:shadow-lg transition"
                >
                  Get Your Clear Quote
                </a>
              </div>
            </div>
          </div>
        </section>

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
