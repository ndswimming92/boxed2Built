import React, { useEffect } from 'react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import {
  Phone,
  CheckCircle,
  Download,
  Gift,
  Users,
  Tag,
  Clock,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import OptimizedImage from '../components/ui/OptimizedImage';
import { trackEvent } from '../utils/analytics';
import jsPDF from 'jspdf';

const PartnersPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Boxed2Built Partnerships | Realtors & Movers in Spring Hill';

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        'content',
        'Realtors & movers—add value for clients with Boxed2Built furniture assembly partnerships. Stress-free move-ins, referral benefits & closing gifts.'
      );
    }

    // Set canonical URL for this page
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/partners');
  }, []);

  const handleContactClick = () => {
    trackEvent('link_click', 'partners_page_hero', {
      event_category: 'navigation',
      event_label: 'contact_link_partners',
      element_type: 'link',
      element_location: 'partners_page_hero',
      page_section: 'partners_page_hero',
      action_type: 'click',
      action_value: '/contact',
    });
  };

  const handleFlyerDownload = () => {
    trackEvent('file_download', 'partners_page_flyer', {
      event_category: 'download',
      event_label: 'realtor_flyer_download',
      value: 1,
      element_type: 'button',
      element_location: 'partners_page_flyer',
      page_section: 'partners_page_flyer',
      action_type: 'download',
      action_value: 'realtor_flyer_pdf',
    });

    // Create PDF document
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = 30;

    // Helper function to add text with automatic line wrapping
    const addText = (
      text: string,
      fontSize: number = 10,
      isBold: boolean = false,
      color: string = '#000000'
    ) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.setTextColor(color);

      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * fontSize * 0.4 + 5;

      // Add new page if needed
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 30;
      }
    };

    const addSection = (title: string, content: string[]) => {
      addText(title, 14, true, '#1e40af');
      yPosition += 5;
      content.forEach((item) => {
        addText(item, 10);
      });
      yPosition += 10;
    };

    // Header
    addText('BOXED2BUILT - REALTOR PARTNERSHIP PROGRAM', 18, true, '#1e40af');
    addText('Professional Furniture Assembly Service | Spring Hill, TN', 12, false, '#374151');
    yPosition += 10;

    // Main value proposition
    addText('MAKE MOVE-IN DAY STRESS-FREE FOR YOUR CLIENTS', 16, true, '#059669');
    addText(
      "Partner with Boxed2Built to offer professional furniture assembly as a memorable closing gift that your clients will actually use!",
      11
    );
    yPosition += 10;

    // Contact Information
    addSection('CONTACT INFORMATION', [
      'Phone: (615) 403-4538',
      'Email: boxed2builtco@gmail.com',
      'Website: boxed2built.com',
      "Service Area: Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood & surrounding Tennessee areas",
    ]);

    // Partnership Benefits
    addSection('PARTNERSHIP BENEFITS', [
      "✓ Memorable closing gift that clients actually use",
      '✓ Personalized discount code tied to your name',
      '✓ Track your referrals and client satisfaction',
      '✓ Professional service that reflects well on you',
      '✓ Flexible scheduling around closing timelines',
      '✓ No upfront costs or commitments required',
    ]);

    // Services
    addSection('SERVICES WE PROVIDE', [
      'IKEA Furniture Assembly:',
      '• Beds, dressers, wardrobes, desks',
      '• Bookshelves, storage solutions',
      '• Kitchen and bathroom furniture',
      '',
      'Target & Walmart Furniture Assembly:',
      '• Bedroom sets and individual pieces',
      '• Living room furniture',
      '• Office and home organization',
      '',
      'General Furniture Assembly:',
      '• All major furniture brands',
      '• Complex multi-piece sets',
      '• Specialty and custom furniture',
    ]);

    // Pricing
    addSection('TRANSPARENT PRICING (Updated 2025)', [
      'Small Furniture (Chairs, Nightstands): $85-$108',
      'Storage & Shelving (Bookshelves, Units): $116-$172',
      'Tables & Desks (Coffee Tables, Desks): $96-$209',
      'Dressers & Storage (Multi-drawer): $166-$204',
      'Beds & Frames (Simple to Complex): $153-$318',
      '',
      'All prices include:',
      '• Professional assembly',
      '• Placement in desired room',
      '• Complete cleanup',
      '• Quality assurance check',
    ]);

    // How it works
    addSection('HOW IT WORKS', [
      '1. PARTNER SETUP',
      '   • Contact us to set up your personalized discount code',
      '   • Receive marketing materials and service information',
      '   • No contracts or commitments required',
      '',
      '2. OFFER TO CLIENTS',
      '   • Present furniture assembly as a closing gift',
      '   • Share our contact information with your clients',
      '   • We handle all scheduling and coordination',
      '',
      '3. PROFESSIONAL SERVICE',
      '   • We contact your clients directly',
      '   • Schedule around their move-in timeline',
      '   • Provide expert assembly service',
      '   • Follow up to ensure satisfaction',
    ]);

    // What clients get
    addSection('WHAT YOUR CLIENTS GET', [
      '✓ Professional furniture assembly service',
      '✓ Flexible scheduling including weekends',
      '✓ All tools and expertise provided',
      '✓ Clean, efficient service',
      '✓ Satisfaction guaranteed',
      '✓ Local Spring Hill business support',
    ]);

    // Partnership options
    addSection('PARTNERSHIP OPTIONS', [
      'CLOSING GIFT OPTION',
      '• Purchase 2-6 hour assembly session as closing gift',
      '• Covers 2-8 furniture pieces depending on complexity',
      '• Branded as your thoughtful closing gift',
      '• Builds lasting client relationships',
      '',
      'REFERRAL PARTNER',
      '• Simply share our information with clients',
      '• No upfront costs or commitments',
      '• We handle all service coordination',
      '• You get credit for helpful resource',
    ]);

    // Why choose us
    addSection('WHY CHOOSE BOXED2BUILT?', [
      'LOCAL EXPERTISE',
      '• Based in Spring Hill, TN',
      '• Serving Middle Tennessee families',
      '• Understanding of local community needs',
      '',
      'PROFESSIONAL SERVICE',
      '• Years of furniture assembly experience',
      '• All major furniture brands supported',
      '• Clean, efficient, reliable service',
      '',
      'CLIENT SATISFACTION',
      '• 5-star Google reviews',
      '• Satisfaction guaranteed',
      '• Professional communication',
    ]);

    // Call to action
    addText('GET STARTED TODAY', 16, true, '#dc2626');
    addText('Ready to offer your clients a stress-free move-in experience?', 12);
    yPosition += 5;

    addSection('CONTACT US', [
      'Call: (615) 403-4538',
      'Email: boxed2builtco@gmail.com',
      'Online: boxed2built.com/partners',
      '',
      'Book a free consultation to discuss partnership options',
      'and get your personalized discount code set up.',
    ]);

    // Footer
    yPosition += 10;
    addText('BOXED2BUILT', 14, true, '#1e40af');
    addText('"We turn boxes into comfort so families can focus on what matters most"', 10, true);
    yPosition += 5;
    addText(
      "Serving Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood & surrounding Tennessee communities",
      9
    );
    addText('Professional Furniture Assembly • Weekend Service Available • Satisfaction Guaranteed', 9);

    // Save the PDF
    pdf.save('Boxed2Built-Realtor-Partnership-Program.pdf');
  };

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-6 md:py-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Partners', href: '/partners', current: true },
                ]}
                className="mb-4 md:mb-6"
              />
            </div>
          </div>
        </section>

        {/* Hero Section */}
        <section className="py-10 md:py-14 bg-gradient-to-br from-blue-50 to-gray-100">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 mb-3 md:mb-6">
                Partner with Boxed2Built
              </h1>
              <p className="text-base sm:text-lg md:text-2xl text-gray-600 mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed">
                Give your clients a stress-free move-in. We assemble furniture so buyers enjoy their new home day one.
              </p>

              <div className="flex justify-center">
                <a
                  href="/contact"
                  onClick={handleContactClick}
                  className="inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-4 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm sm:text-base"
                >
                  Contact Us
                </a>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-gray-600">
                Built for Realtors, Movers, and Local Partners across Spring Hill & Middle TN.
              </p>
            </div>
          </div>
        </section>

        {/* For Realtors Section */}
        <section className="py-10 md:py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8 text-center">
                For Realtors
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-10">
                <div className="text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Gift className="text-blue-600" size={28} />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                    Closing gift clients actually use
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                    Give buyers something they’ll truly appreciate: professional furniture assembly for their new home.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Clock className="text-green-600" size={28} />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                    Fast help for move-in day
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                    We coordinate with closing timelines so furniture is ready when your clients get their keys.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Tag className="text-purple-600" size={28} />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                    Discount code tied to your name
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                    Track referrals and give clients exclusive savings with your personalized discount code.
                  </p>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleFlyerDownload}
                  className="inline-flex items-center justify-center px-5 py-3 md:px-6 md:py-3 bg-green-700 hover:bg-green-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm sm:text-base"
                >
                  <Download size={18} className="mr-2" />
                  Download Realtor Flyer (PDF)
                </button>

                <p className="mt-3 text-xs sm:text-sm text-gray-600">
                  Great for open houses, closing packets, and client welcome baskets.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ways to Work Together Section */}
        <section className="py-10 md:py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-8 md:mb-10 text-center">
                Ways to Work Together
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                <div className="bg-white p-5 md:p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                  <div className="w-11 h-11 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 md:mb-6">
                    <Gift className="text-blue-600" size={22} />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">Closing Gift</h3>
                  <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
                    Offer a 2–6 hour furniture assembly session as a memorable closing gift—perfect for essentials like
                    beds, dining tables, or a full room setup.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• 2–6 hour professional assembly session</li>
                    <li>• Covers 2–8 furniture pieces (varies by complexity)</li>
                    <li>• Scheduled around move-in timeline</li>
                    <li>• Branded as your closing gift</li>
                  </ul>
                </div>

                <div className="bg-white p-5 md:p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                  <div className="w-11 h-11 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 md:mb-6">
                    <Users className="text-green-600" size={22} />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">Referral Partner</h3>
                  <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
                    Share our info with clients who need assembly. No commitment—just a helpful resource that makes you
                    look great.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Share our contact information</li>
                    <li>• No upfront costs or commitments</li>
                    <li>• We handle scheduling and service</li>
                    <li>• Builds goodwill with buyers</li>
                  </ul>
                </div>

                <div className="bg-white p-5 md:p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                  <div className="w-11 h-11 md:w-12 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 md:mb-6">
                    <CheckCircle className="text-purple-600" size={22} />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">Professional Service</h3>
                  <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
                    Your clients get the same clean, professional assembly we provide every day—across all major
                    furniture brands.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Expert assembly for all brands</li>
                    <li>• Clean, respectful work</li>
                    <li>• Flexible scheduling options</li>
                    <li>• Satisfaction guaranteed</li>
                  </ul>
                </div>
              </div>

              {/* Optional: keep testimonials, but tighten spacing */}
              <div className="mt-10 md:mt-14">
                <Testimonials />
              </div>
            </div>
          </div>
        </section>

        {/* Questions FAQ Section */}
        <section className="py-10 md:py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8 md:mb-10">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">Questions?</h2>
                <p className="text-base sm:text-lg md:text-xl text-gray-600">
                  Common questions about our partnership program
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="bg-white p-5 md:p-6 rounded-xl shadow-md">
                  <div className="flex items-start mb-2 md:mb-3">
                    <HelpCircle size={20} className="text-blue-600 mr-3 mt-1 flex-shrink-0" />
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">How does scheduling work?</h3>
                  </div>
                  <p className="text-sm md:text-base text-gray-600 ml-8 leading-relaxed">
                    We coordinate directly with your clients around their move-in timeline. Typically 24–48 hours notice
                    is enough to get things scheduled.
                  </p>
                </div>

                <div className="bg-white p-5 md:p-6 rounded-xl shadow-md">
                  <div className="flex items-start mb-2 md:mb-3">
                    <MapPin size={20} className="text-green-600 mr-3 mt-1 flex-shrink-0" />
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">What’s your coverage area?</h3>
                  </div>
                  <p className="text-sm md:text-base text-gray-600 ml-8 leading-relaxed">
                    We serve Spring Hill, Franklin, Columbia, Thompson’s Station, Brentwood, and the greater Nashville
                    area. Reach out to confirm a specific address.
                  </p>
                </div>

                <div className="bg-white p-5 md:p-6 rounded-xl shadow-md">
                  <div className="flex items-start mb-2 md:mb-3">
                    <Clock size={20} className="text-purple-600 mr-3 mt-1 flex-shrink-0" />
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">What’s the typical turnaround?</h3>
                  </div>
                  <p className="text-sm md:text-base text-gray-600 ml-8 leading-relaxed">
                    Most projects take 2–4 hours depending on complexity. We can often do same-day or next-day scheduling
                    for urgent move-ins.
                  </p>
                </div>

                <div className="bg-white p-5 md:p-6 rounded-xl shadow-md">
                  <div className="flex items-start mb-2 md:mb-3">
                    <CheckCircle size={20} className="text-amber-600 mr-3 mt-1 flex-shrink-0" />
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">How do I get started?</h3>
                  </div>
                  <p className="text-sm md:text-base text-gray-600 ml-8 leading-relaxed">
                    Contact us and we’ll walk through options. We can set up your personalized discount code and share
                    simple marketing materials for your clients.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Band */}
        <section className="py-10 md:py-12 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-6">Ready to make move-in effortless?</h2>
              <p className="text-base md:text-xl text-blue-50 mb-6 md:mb-8 leading-relaxed">
                Partner with Boxed2Built to give your clients the stress-free move-in experience they deserve.
              </p>

              <div className="flex justify-center">
                <a
                  href="/contact"
                  onClick={handleContactClick}
                  className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
                >
                  <Phone size={18} className="mr-2" />
                  Contact Us Today
                </a>
              </div>

              <p className="text-[11px] sm:text-xs text-blue-50 mt-5 md:mt-6">
                Weekend furniture assembly service • Serving Spring Hill, Franklin, Columbia, Nashville & surrounding TN
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default PartnersPage;
