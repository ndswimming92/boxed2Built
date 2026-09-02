import React from 'react';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import { useBookingEnabled } from '../../hooks/useBookingPublicInfo';

interface BookingCalloutProps {
  /** Where this instance sits, for analytics. */
  pageSection: string;
  /** Overrides the default line when a page can be more specific about the work. */
  body?: string;
  className?: string;
}

/**
 * "Skip the back-and-forth and pick a time" — the alternative to the quote form,
 * for someone who already knows what they need.
 *
 * It renders nothing when booking is switched off, so a page can drop it in
 * without also having to know whether booking is open this week.
 */
const BookingCallout: React.FC<BookingCalloutProps> = ({ pageSection, body, className = '' }) => {
  const bookingEnabled = useBookingEnabled();

  if (!bookingEnabled) return null;

  return (
    <div
      className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-7 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
          <CalendarCheck className="w-5 h-5 text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-gray-900">Already know what you need?</h3>
          <p className="text-sm sm:text-base text-gray-700 mt-1">
            {body ??
              'Skip the back-and-forth — see the days and start times we actually have open and take one.'}
          </p>
          <a
            href="/book"
            onClick={() =>
              trackEvent('cta_click', pageSection, {
                event_category: 'conversion',
                event_label: `book_time_${pageSection}`,
                value: 1,
                element_type: 'link',
                element_location: pageSection,
                page_section: pageSection,
                action_type: 'click',
                action_value: '/book',
                conversion_type: 'booking_intent',
              })
            }
            className="group mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-700 hover:shadow-lg"
          >
            See open times
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default BookingCallout;

interface BookingTextLinkProps {
  pageSection: string;
  /** `light` reads on a dark band; `dark` reads on a white or grey one. */
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * The same offer as BookingCallout, as one line rather than a card.
 *
 * The service pages end on a dark CTA band that already carries a call button
 * and a quote button. A third button there would be three competing asks in a
 * row; a line underneath keeps the quote primary and still puts booking in
 * front of someone who is deep enough in the page to be scoping a real job.
 */
export const BookingTextLink: React.FC<BookingTextLinkProps> = ({
  pageSection,
  tone = 'dark',
  className = '',
}) => {
  const bookingEnabled = useBookingEnabled();

  if (!bookingEnabled) return null;

  const bodyTone = tone === 'light' ? 'text-blue-100' : 'text-gray-600';
  const linkTone =
    tone === 'light'
      ? 'text-white decoration-blue-300 hover:decoration-white'
      : 'text-blue-700 decoration-blue-300 hover:text-blue-800 hover:decoration-blue-500';

  return (
    <p className={`text-sm sm:text-base ${bodyTone} ${className}`}>
      Prefer to just pick a time?{' '}
      <a
        href="/book"
        onClick={() =>
          trackEvent('cta_click', pageSection, {
            event_category: 'conversion',
            event_label: `book_time_${pageSection}`,
            value: 1,
            element_type: 'link',
            element_location: pageSection,
            page_section: pageSection,
            action_type: 'click',
            action_value: '/book',
            conversion_type: 'booking_intent',
          })
        }
        className={`font-semibold underline underline-offset-2 ${linkTone}`}
      >
        See the days and times we have open
      </a>
      .
    </p>
  );
};
