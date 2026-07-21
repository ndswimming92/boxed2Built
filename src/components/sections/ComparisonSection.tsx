import React from 'react';
import { MapPin, Smartphone, Check, X } from 'lucide-react';

const COMPARISON_ROWS = [
  {
    label: 'Who you work with',
    b2b: 'Directly with a local Spring Hill service',
    app: 'Often routed through a platform and rotating providers'
  },
  {
    label: 'Quote process',
    b2b: 'Clear quotes based on your actual items and photos',
    app: 'Generalized pricing tiers and in-app variables'
  },
  {
    label: 'Service focus',
    b2b: 'Furniture assembly, TV mounting, and move-in setups',
    app: 'Broad gig categories with mixed specialization'
  },
  {
    label: 'Experience style',
    b2b: 'Personal communication and careful workmanship',
    app: 'App-based messaging with less continuity'
  }
];

const ComparisonSection: React.FC = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-50 via-white to-emerald-50 border border-blue-100 rounded-2xl shadow-sm p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
            Why Choose Boxed2Built Instead of a Marketplace App?
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-5">
            Marketplace apps can connect you with available providers, but Boxed2Built gives you a more personal local experience. You work directly with a Spring Hill-based furniture assembly service focused on clear quotes, careful workmanship, and helping busy families enjoy their homes sooner.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-5">
            From flat-pack furniture and TV mounting to nursery setups, patio furniture, garage storage, and move-in projects, Boxed2Built is built around one simple goal:
          </p>
          <p className="text-xl md:text-2xl font-semibold text-gray-900 mb-10">
            Turning boxes into comfort so families can focus on what matters most.
          </p>

          <div className="mb-12 rounded-2xl border border-gray-200 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="overflow-x-auto">
              <div
                role="table"
                aria-label="Boxed2Built vs marketplace app comparison"
                className="grid min-w-[640px] grid-cols-[22%_39%_39%]"
              >
                <div role="row" className="contents">
                  <div role="columnheader" className="px-6 py-[18px] bg-gray-50 border-b-2 border-gray-200">
                    <span className="sr-only">What matters</span>
                  </div>
                  <div role="columnheader" className="px-6 py-[18px] bg-blue-700 flex items-center gap-2.5">
                    <MapPin size={20} className="text-white shrink-0" aria-hidden="true" />
                    <span className="text-[17px] font-bold text-white">Boxed2Built</span>
                  </div>
                  <div role="columnheader" className="px-6 py-[18px] bg-gray-50 border-b-2 border-gray-200 flex items-center gap-2.5">
                    <Smartphone size={20} className="text-gray-500 shrink-0" aria-hidden="true" />
                    <span className="text-[17px] font-semibold text-gray-600">Marketplace Apps</span>
                  </div>
                </div>

                {COMPARISON_ROWS.map(row => (
                  <div key={row.label} role="row" className="contents">
                    <div role="rowheader" className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex items-center">
                      <span className="text-[15px] font-semibold text-gray-900 leading-snug">{row.label}</span>
                    </div>
                    <div role="cell" className="px-6 py-5 bg-blue-50 border-t border-blue-100 flex items-center gap-2.5">
                      <Check size={20} strokeWidth={2.25} className="text-blue-700 shrink-0" aria-hidden="true" />
                      <span className="text-[15px] font-medium text-blue-900 leading-relaxed">{row.b2b}</span>
                    </div>
                    <div role="cell" className="px-6 py-5 border-t border-gray-100 flex items-center gap-2.5">
                      <X size={20} strokeWidth={2.25} className="text-gray-300 shrink-0" aria-hidden="true" />
                      <span className="text-[15px] text-gray-500 leading-relaxed">{row.app}</span>
                    </div>
                  </div>
                ))}
              </div>
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
  );
};

export default ComparisonSection;
