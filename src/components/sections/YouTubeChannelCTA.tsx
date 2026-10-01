import React from 'react';
import { Youtube, Play, Clock, Sparkles, Wrench, Camera, ArrowRight, Quote } from 'lucide-react';
import { getSocialUrl } from '../../utils/utm';
import { trackEvent } from '../../utils/analytics';

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@Boxed2BuiltUSA';

const HIGHLIGHTS = [
  {
    icon: Clock,
    title: 'Time-lapse builds',
    text: 'Watch a full piece go from boxed to built in seconds.',
  },
  {
    icon: Camera,
    title: 'Before & after reveals',
    text: 'See the finished result in real Middle Tennessee homes.',
  },
  {
    icon: Wrench,
    title: 'Assembly tips',
    text: 'Pro tricks for tricky furniture, hardware and instructions.',
  },
  {
    icon: Sparkles,
    title: 'Behind the scenes',
    text: 'Meet the work, the tools and the people behind Boxed2Built.',
  },
];

const YouTubeChannelCTA: React.FC = () => {
  const handleClick = () => {
    trackEvent('social_click', 'gallery_youtube_cta', {
      event_category: 'social_media',
      event_label: 'social_click_youtube',
      element_type: 'button',
      element_location: 'gallery_youtube_cta',
      page_section: 'gallery_youtube_cta',
      action_type: 'social_click',
      action_value: 'youtube',
    });
  };

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-blue-50 border-t border-gray-200">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
          <div className="grid md:grid-cols-5">
            {/* Pitch */}
            <div className="md:col-span-3 p-8 md:p-10">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-4">
                <Play size={14} className="fill-current" aria-hidden="true" />
                Watch more on YouTube
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Want to see the build, not just the result?
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Photos only tell half the story. Our YouTube channel is where you can watch
                furniture assembly happen start to finish, from time-lapse builds to
                before &amp; after reveals from homes around Spring Hill, Franklin and Columbia.
              </p>

              <a
                href={getSocialUrl('youtube', YOUTUBE_CHANNEL_URL)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                className="group inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-7 py-4 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <Youtube size={26} aria-hidden="true" />
                Subscribe on YouTube
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </a>
              <p className="text-sm text-gray-500 mt-3">
                Free to watch. New builds added regularly.
              </p>
            </div>

            {/* What you'll find */}
            <div className="md:col-span-2 bg-blue-50 p-8 md:p-10 border-t md:border-t-0 md:border-l border-blue-100">
              <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-5">
                What you'll find
              </p>
              <ul className="space-y-4">
                {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-white text-blue-700 flex items-center justify-center shadow-sm">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-semibold text-gray-900">{title}</span>
                      <span className="block text-sm text-gray-600">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Customer quote */}
          <figure className="border-t border-blue-100 bg-white px-8 md:px-10 py-6 flex items-start gap-4">
            <Quote size={28} className="text-blue-300 flex-shrink-0" aria-hidden="true" />
            <div>
              <blockquote className="text-gray-700 italic">
                &ldquo;Enjoyed having Nick in my home. Put two pieces of furniture together in 2 hours on a Friday night.&rdquo;
              </blockquote>
              <figcaption className="text-sm text-gray-500 mt-1">
                Tia L., 5-star Google review
              </figcaption>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
};

export default YouTubeChannelCTA;
