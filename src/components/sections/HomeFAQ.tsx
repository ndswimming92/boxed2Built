import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import InternalLink from '../ui/InternalLink';

interface FAQItem {
  question: string;
  answer: string;
}

interface HomeFAQProps {
  faqs: FAQItem[];
  title?: string;
  subtitle?: string;
  showViewAllLink?: boolean;
  className?: string;
}

const HomeFAQ: React.FC<HomeFAQProps> = ({
  faqs,
  title = 'Frequently Asked Questions',
  subtitle = 'Get answers to common questions about furniture assembly in Spring Hill, TN',
  showViewAllLink = true,
  className = ''
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className={`py-16 bg-gradient-to-br from-gray-50 to-blue-50 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <HelpCircle className="text-blue-600 mr-3" size={32} />
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                {title}
              </h2>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {subtitle}
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 text-left flex items-start justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
                  aria-expanded={openIndex === index}
                  aria-controls={`faq-answer-${index}`}
                >
                  <h3 className="text-lg font-semibold text-gray-900 pr-4">
                    {faq.question}
                  </h3>
                  <span className="flex-shrink-0 text-blue-600 mt-1">
                    {openIndex === index ? (
                      <ChevronUp size={24} />
                    ) : (
                      <ChevronDown size={24} />
                    )}
                  </span>
                </button>

                <div
                  id={`faq-answer-${index}`}
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openIndex === index ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-6 text-gray-700 leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* View All FAQs Link */}
          {showViewAllLink && (
            <div className="text-center mt-10">
              <InternalLink
                to="/faq"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold text-lg transition-colors duration-200"
              >
                View All FAQs
                <ChevronDown className="ml-2 transform rotate-[-90deg]" size={20} />
              </InternalLink>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HomeFAQ;
