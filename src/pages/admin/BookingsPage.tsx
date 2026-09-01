import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { Booking, BookingStatus } from '../../lib/supabase';
import { getDirectionsUrl } from '../../utils/jobAddress';
import { getBookingTravelEstimate } from '../../services/jobTravelService';
import TravelEstimateCard from '../../components/admin/TravelEstimateCard';
import {
  confirmBooking,
  declineBooking,
  formatDateLabel,
  formatDurationLabel,
  formatTimeLabel,
  getBookingPhotoUrl,
  getBookings,
  toDateKey,
} from '../../services/bookingService';

type StatusFilter = BookingStatus | 'all';

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'pending', label: 'Needs a decision' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'declined', label: 'Declined' },
  { value: 'all', label: 'All' },
];

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-600',
  declined: 'bg-red-100 text-red-700',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const flash = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await getBookings({ status, searchTerm: searchTerm.trim() || undefined }));
    } catch (error) {
      flash('error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, searchTerm, flash]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = useMemo(() => toDateKey(new Date()), []);

  const handleConfirm = async (booking: Booking) => {
    setBusyId(booking.id);
    try {
      await confirmBooking(booking.id);
      flash('success', `${booking.reference} confirmed — it is on your Jobs calendar now.`);
      await load();
    } catch (error) {
      flash('error', (error as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (booking: Booking) => {
    const reason = window.prompt(
      `Decline ${booking.reference}? Add a short reason (optional) — it is kept on the booking for your records.`,
      '',
    );

    // prompt() returns null when dismissed, '' when submitted empty.
    if (reason === null) return;

    setBusyId(booking.id);
    try {
      await declineBooking(booking.id, reason.trim() || undefined);
      flash('success', `${booking.reference} declined and the slot is free again.`);
      await load();
    } catch (error) {
      flash('error', (error as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length;

  return (
    <div className="max-w-5xl px-0">
      <div className="mb-6 sm:mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Bookings</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Times customers took from your public booking page.
          </p>
        </div>
        <Link
          to="/admin/booking-availability"
          className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <Settings2 className="w-4 h-4" />
          Availability settings
        </Link>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CalendarCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p
            className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}
          >
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  status === tab.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
                {tab.value === 'pending' && status === 'pending' && pendingCount > 0
                  ? ` (${pendingCount})`
                  : ''}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, email or BK-…"
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Nothing here</p>
            <p className="text-sm text-slate-500 mt-1">
              {status === 'pending'
                ? 'No bookings are waiting on you.'
                : 'No bookings match this filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                today={today}
                busy={busyId === booking.id}
                onConfirm={() => handleConfirm(booking)}
                onDecline={() => handleDecline(booking)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingRow({
  booking,
  today,
  busy,
  onConfirm,
  onDecline,
}: {
  booking: Booking;
  today: string;
  busy: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  const isPast = booking.booking_date < today;
  const decidable = booking.status === 'pending';
  const [showTravel, setShowTravel] = useState(false);

  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                STATUS_STYLES[booking.status]
              }`}
            >
              {booking.status}
            </span>
            <span className="text-xs font-mono text-slate-500">{booking.reference}</span>
            {isPast && booking.status === 'confirmed' && (
              <span className="text-xs text-slate-500">· date has passed</span>
            )}
          </div>

          <p className="text-base font-semibold text-slate-900">
            {formatDateLabel(booking.booking_date, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            {' · '}
            {formatTimeLabel(booking.start_time)} – {formatTimeLabel(booking.end_time)}
            <span className="text-slate-500 font-normal text-sm">
              {' '}
              ({formatDurationLabel(booking.duration_minutes)})
            </span>
          </p>

          <p className="text-sm text-slate-700 mt-1">
            <span className="font-medium">{booking.customer_name}</span>
            {booking.service_name ? ` · ${booking.service_name}` : ''}
            {booking.pieces ? ` · ${booking.pieces} piece${booking.pieces === 1 ? '' : 's'}` : ''}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
            <a
              href={`mailto:${booking.customer_email}`}
              className="flex items-center gap-1.5 hover:text-emerald-700"
            >
              <Mail className="w-3.5 h-3.5" />
              {booking.customer_email}
            </a>
            {booking.customer_phone && (
              <a
                href={`tel:${booking.customer_phone}`}
                className="flex items-center gap-1.5 hover:text-emerald-700"
              >
                <Phone className="w-3.5 h-3.5" />
                {booking.customer_phone}
              </a>
            )}
            {booking.service_address && (
              <a
                href={getDirectionsUrl(booking.service_address)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open directions to this address"
                className="flex items-center gap-1.5 hover:text-emerald-700 underline decoration-slate-300 hover:decoration-emerald-500"
              >
                <MapPin className="w-3.5 h-3.5" />
                {booking.service_address}
              </a>
            )}
          </div>

          {booking.service_address && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowTravel((open) => !open)}
                aria-expanded={showTravel}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <Car className="w-3.5 h-3.5" />
                {showTravel ? 'Hide drive time' : 'Drive time from home base'}
                {showTravel ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Mounted only once opened: each mount can cost a Mapbox call, and
                  a queue of bookings would otherwise fire one per row on load. */}
              {showTravel && (
                <div className="mt-2 max-w-lg">
                  <TravelEstimateCard
                    address={booking.service_address}
                    reloadKey={booking.id}
                    loadEstimate={() => getBookingTravelEstimate(booking.id)}
                  />
                </div>
              )}
            </div>
          )}

          {booking.notes && (
            <p className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">
              {booking.notes}
            </p>
          )}

          {booking.photo_paths.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {booking.photo_paths.map((path) => (
                <a
                  key={path}
                  href={getBookingPhotoUrl(path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-400 transition-colors"
                >
                  <img
                    src={getBookingPhotoUrl(path)}
                    alt="Furniture the customer attached"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          {(booking.decision_note || booking.cancellation_reason) && (
            <p className="mt-2 text-xs text-slate-500">
              {booking.cancellation_reason
                ? `Cancelled by ${booking.cancelled_by ?? 'someone'}: ${booking.cancellation_reason}`
                : `Note: ${booking.decision_note}`}
            </p>
          )}
        </div>

        <div className="flex flex-row lg:flex-col gap-2 lg:w-40 flex-shrink-0">
          {decidable && (
            <>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {busy ? 'Working…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Decline
              </button>
            </>
          )}

          {booking.job_id && (
            <Link
              to="/admin/jobs"
              className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              View job
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
