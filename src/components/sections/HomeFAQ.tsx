import React, { useState } from 'react';
import { ArrowRight, HelpCircle } from 'lucide-react';
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className={`py-16 bg-gradient-to-br from-gray-50 to-blue-50 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
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

          <div className="space-y-6">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <details
                  key={index}
                  className="bg-white rounded-lg shadow-md p-6 group"
                  open={isOpen}
                  onToggle={(e) => {
                    const target = e.currentTarget;
                    if (target.open) {
                      setOpenIndex(index);
                    } else if (isOpen) {
                      setOpenIndex(null);
                    }
                  }}
                >
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="mt-4 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              );
            })}
          </div>

          {showViewAllLink && (
            <div className="text-center mt-10">
              <InternalLink
                to="/faq"
                className="inline-flex items-center text-blue-700 font-semibold text-lg hover:text-blue-800 transition-colors duration-200"
              >
                View All FAQs
                <ArrowRight className="ml-2 w-5 h-5" />
              </InternalLink>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HomeFAQ;
