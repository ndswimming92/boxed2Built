import React from 'react';
import { Truck, Wrench, Armchair, ArrowRight, BadgeCheck, MapPin, Star } from 'lucide-react';

interface Step {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  accent: 'blue' | 'green';
  connector: boolean;
}

const STEPS: Step[] = [
  {
    icon: <Truck size={26} className="text-white" aria-hidden="true" />,
    eyebrow: 'Step 01',
    title: 'We Show Up On Time',
    description:
      'Send photos or item links, get a clear quote — no generalized pricing tiers, no surprises at the door.',
    accent: 'blue',
    connector: true
  },
  {
    icon: <Wrench size={26} className="text-white" aria-hidden="true" />,
    eyebrow: 'Step 02',
    title: 'We Build It Right',
    description:
      'IKEA, Target, Walmart, Wayfair — every bolt torqued, every door aligned, every piece stability-tested.',
    accent: 'blue',
    connector: true
  },
  {
    icon: <Armchair size={26} className="text-white" aria-hidden="true" />,
    eyebrow: 'Step 03',
    title: 'You Enjoy the Room',
    description:
      "Boxes broken down, packaging gone, furniture placed. You don't pay until you're happy with the build.",
    accent: 'green',
    connector: false
  }
];

const WhyChooseSection: React.FC = () => {
  return (
    <section className="py-[72px] px-8 bg-gradient-to-br from-blue-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-12 lg:gap-[72px] items-start">
          {/* Left column — process */}
          <div>
            <div>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold tracking-[0.08em] uppercase mb-5">
                Why Boxed2Built
              </span>
              <h2 className="text-4xl md:text-[42px] font-extrabold text-gray-900 leading-tight tracking-tight mb-3.5 text-pretty">
                From Cardboard Chaos to Room Reveal — in One Visit
              </h2>
              <p className="text-lg md:text-[19px] text-gray-600 leading-relaxed mb-12 max-w-xl text-pretty">
                No confusing instructions, no leftover hardware, no app-hopping. Here's how it works.
              </p>
            </div>

            <div className="flex flex-col">
              {STEPS.map(step => (
                <div key={step.eyebrow} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div
                      className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${
                        step.accent === 'blue'
                          ? 'bg-blue-700 shadow-[0_4px_6px_-1px_rgba(29,78,216,0.35)]'
                          : 'bg-green-700 shadow-[0_4px_6px_-1px_rgba(21,128,61,0.35)]'
                      }`}
                    >
                      {step.icon}
                    </div>
                    {step.connector && (
                      <div className="flex-1 w-0.5 my-2 bg-[repeating-linear-gradient(to_bottom,#93C5FD_0_6px,transparent_6px_12px)]" />
                    )}
                  </div>
                  <div className={step.connector ? 'pb-9' : ''}>
                    <div
                      className={`text-xs font-bold tracking-[0.1em] uppercase mb-1 ${
                        step.accent === 'blue' ? 'text-blue-600' : 'text-green-700'
                      }`}
                    >
                      {step.eyebrow}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1.5">{step.title}</h3>
                    <p className="text-base text-gray-700 leading-relaxed max-w-[480px]">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-12">
              <a
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[17px] font-semibold shadow-md hover:shadow-lg transition"
              >
                Get a Free Quote
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a
                href="/services"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-[17px] font-semibold hover:border-blue-600 hover:text-blue-700 transition"
              >
                See Transparent Pricing
              </a>
            </div>
          </div>

          {/* Right column — proof */}
          <div className="flex flex-col gap-6">
            <img
              src="/images/marketing-images/Boxed2Built_Skip_The_Build_Enjoy_Moments.png"
              alt="Skip the build — Boxed2Built assembles your flat-pack furniture so you can enjoy the room"
              className="w-full rounded-xl shadow-lg block"
              loading="lazy"
              width="600"
              height="400"
            />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-5 py-3 shadow-sm">
                <span className="inline-flex text-yellow-500" aria-hidden="true">
                  <Star size={18} fill="currentColor" strokeWidth={1} />
                  <Star size={18} fill="currentColor" strokeWidth={1} />
                  <Star size={18} fill="currentColor" strokeWidth={1} />
                  <Star size={18} fill="currentColor" strokeWidth={1} />
                  <Star size={18} fill="currentColor" strokeWidth={1} />
                </span>
                <span className="text-[15px] font-semibold text-gray-900">5.0 on Google</span>
                <a
                  href="https://www.google.com/search?q=boxed2built"
                  className="text-sm font-medium text-blue-700 underline ml-auto"
                >
                  Read reviews
                </a>
              </div>
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-5 py-3 shadow-sm">
                <BadgeCheck size={20} className="text-emerald-700" aria-hidden="true" />
                <span className="text-[15px] font-semibold text-gray-900">No Payment Until Done</span>
              </div>
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-5 py-3 shadow-sm">
                <MapPin size={20} className="text-blue-700" aria-hidden="true" />
                <span className="text-[15px] font-semibold text-gray-900">
                  Locally Owned — Spring Hill, TN
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseSection;
