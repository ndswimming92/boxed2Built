import React from 'react';
import { Clock3 } from 'lucide-react';
import {
  calculateClientTimeSaved,
  CLIENT_TIME_SAVED_SUBTITLE,
  CLIENT_TIME_SAVED_TITLE,
} from '../../services/analyticsService';
import SplitFlapNumber from '../SplitFlapNumber';

type ClientHoursSavedStatProps = {
  totalHoursSaved?: number | null;
};

const ClientHoursSavedStat: React.FC<ClientHoursSavedStatProps> = ({ totalHoursSaved }) => {
  const statRef = React.useRef<HTMLElement | null>(null);
  const [shouldAnimate, setShouldAnimate] = React.useState(false);
  const hasAnimatedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasAnimatedRef.current) {
      return;
    }

    const element = statRef.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          setShouldAnimate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const safeHours = Number(totalHoursSaved) || 0;
  const clientTimeSavedMetric = calculateClientTimeSaved([safeHours]);
  const metricLabelMatch = clientTimeSavedMetric.label.match(/([\d.]+)\s*(.*)/);
  const numericPart = metricLabelMatch?.[1] ?? clientTimeSavedMetric.label;
  const suffix = metricLabelMatch?.[2] ?? '';

  return (
    <section ref={statRef} className="py-10 bg-white border-b border-gray-100" aria-label="Client time saved">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-green-50 p-6 md:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow">
                <Clock3 className="w-6 h-6" />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase">
                  {CLIENT_TIME_SAVED_TITLE}
                </p>
                <p className="text-3xl md:text-4xl font-bold text-gray-900 mt-1 inline-flex items-baseline gap-2">
                  <SplitFlapNumber value={numericPart} shouldAnimate={shouldAnimate} />
                  {suffix ? <span>{suffix}</span> : null}
                </p>
                <p className="text-sm text-gray-600 mt-2">{CLIENT_TIME_SAVED_SUBTITLE}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientHoursSavedStat;
