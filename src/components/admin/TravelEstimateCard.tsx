import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Car, Clock, MapPinned, RefreshCw, Route } from 'lucide-react';
import { getDirectionsUrl } from '../../utils/jobAddress';
import {
  formatTravelDistance,
  formatTravelDuration,
  type JobTravelEstimate,
} from '../../services/jobTravelService';

interface TravelEstimateCardProps {
  /** Where the work is. Renders nothing when there is no address on file. */
  address: string | null;
  /** Fetches the estimate. Identified only by id, so the address stays server-resolved. */
  loadEstimate: () => Promise<JobTravelEstimate>;
  /** Changes when the underlying row changes, so a re-fetch is not missed. */
  reloadKey: string;
}

/**
 * Shared by the map, the skeleton and the placeholder so switching between states
 * never shifts the card.
 *
 * `aspect-[3/2]` matches the image the edge function requests, and `object-contain`
 * guarantees the whole route stays visible. The previous `h-40 object-cover` cropped
 * badly: the job card is ~1450px wide, so a full-width 160px-tall box is roughly 9:1,
 * and cover scaled the 3:2 image up to fill it and sliced off everything but a middle
 * band. The max-width keeps the map from dominating the card on a wide screen.
 */
const MAP_CLASSES =
  'w-full max-w-lg aspect-[3/2] object-contain rounded-lg border border-slate-200 bg-slate-100';

/**
 * Drive time from the private trip origin to a job or a booking, with a rendered
 * route map.
 *
 * Mounted only when a card is expanded, so a page of collapsed rows costs
 * nothing — each mount can mean a Mapbox call. The map arrives as a data URI
 * because the Mapbox call happens in the `job-travel-estimate` edge function —
 * an <img> tag cannot send an Authorization header, so a URL the browser could
 * load directly would have to be public.
 */
export default function TravelEstimateCard({
  address: workAddress,
  loadEstimate,
  reloadKey,
}: TravelEstimateCardProps) {
  const [estimate, setEstimate] = useState<JobTravelEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!workAddress) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadEstimate()
      .then((result) => {
        if (!cancelled) setEstimate(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Drive time lookup failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // A card that collapses mid-flight must not write into an unmounted card.
    return () => {
      cancelled = true;
    };
    // loadEstimate is recreated each render by its caller; reloadKey is the
    // stable identity of the row it fetches for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, workAddress, attempt]);

  if (!workAddress) return null;

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
        <Car className="w-3 h-3" />
        Drive From Home Base
      </p>

      {loading && (
        <div className="animate-pulse">
          <div className={`${MAP_CLASSES} animate-pulse`} />
          <div className="h-4 w-40 bg-slate-200 rounded mt-2" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-amber-900 break-words">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
            >
              <RefreshCw className="w-3 h-3" />
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && estimate?.status === 'ok' && (
        <>
          <a
            href={getDirectionsUrl(workAddress)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open turn-by-turn directions"
            className="block group"
          >
            {estimate.mapImage ? (
              <img
                src={estimate.mapImage}
                alt={`Route from ${estimate.originAddress ?? 'home base'} to ${workAddress}`}
                loading="lazy"
                className={`${MAP_CLASSES} group-hover:border-emerald-300 transition-colors`}
              />
            ) : (
              <div className={`${MAP_CLASSES} flex items-center justify-center`}>
                <MapPinned className="w-6 h-6 text-slate-300" />
              </div>
            )}
          </a>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              {formatTravelDuration(estimate.durationSeconds)}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
              <Route className="w-3.5 h-3.5 text-slate-400" />
              {formatTravelDistance(estimate.distanceMeters)} each way
            </span>
          </div>
        </>
      )}

      {!loading && !error && estimate?.status === 'not_found' && (
        <p className="text-sm text-slate-500">
          Couldn't find this address on the map — check the spelling, and make sure the city and
          state are included.
        </p>
      )}

      {!loading && !error && estimate?.status === 'no_route' && (
        <p className="text-sm text-slate-500">No drivable route to this address.</p>
      )}

      {!loading && !error && (estimate?.status === 'no_address' || estimate?.status === 'origin_not_found') && (
        <p className="text-sm text-slate-500">
          {estimate.status === 'no_address'
            ? 'Set your starting address on the '
            : "Your starting address couldn't be found on the map. Fix it on the "}
          <Link
            to="/admin/mileage-settings"
            className="font-semibold text-emerald-700 underline hover:text-emerald-800"
          >
            Mileage Settings
          </Link>{' '}
          page to see drive times.
        </p>
      )}
    </div>
  );
}
