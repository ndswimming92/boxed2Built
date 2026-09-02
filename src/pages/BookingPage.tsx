import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useHydrated } from '../hooks/useHydrated';
import { useBookingPublicInfo } from '../hooks/useBookingPublicInfo';
import { SERVICE_AREAS } from '../constants/localSEO';
import { BookingPageConfig, BookingSlot } from '../lib/supabase';
import {
  CreateBookingResult,
  createBooking,
  formatDateLabel,
  formatDurationLabel,
  formatTimeLabel,
  getAvailableSlots,
  getBookingPageConfig,
  toDateKey,
  uploadBookingPhotos,
} from '../services/bookingService';

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // Matches the furniture-photos bucket limit.

/** Local YYYY-MM-DD for the first of the month `offset` months from `base`. */
const monthStart = (base: Date, offset = 0): Date =>
  new Date(base.getFullYear(), base.getMonth() + offset, 1);

const monthEnd = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

/**
 * Carries the customer to the step their last choice just opened up. Each
 * section only exists once the one above it is answered, so without this the
 * new step lands below the fold and the page looks finished when it is not.
 *
 * Waits a frame because the section mounts in the same commit that triggers
 * this, and scrolling before layout settles lands short of the target. Honours
 * prefers-reduced-motion, for whom an unrequested smooth scroll is the problem
 * rather than the fix.
 */
const revealStep = (element: HTMLElement | null): void => {
  if (!element || typeof window === 'undefined') return;

  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  window.requestAnimationFrame(() => {
    element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  });
};

export default function BookingPage() {
  const { user, loading: authLoading, signInWithGoogleForBooking } = useAuth();
  const hydrated = useHydrated();

  const [config, setConfig] = useState<BookingPageConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [serviceId, setServiceId] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pieces, setPieces] = useState('1');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [slotError, setSlotError] = useState('');
  const [result, setResult] = useState<CreateBookingResult | null>(null);

  const timesRef = useRef<HTMLElement | null>(null);
  const detailsRef = useRef<HTMLFormElement | null>(null);

  // Object URLs have to be released explicitly, so they are built once per
  // photo set and revoked when that set is replaced or the page goes away.
  const photoPreviews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );

  useEffect(
    () => () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [photoPreviews],
  );

  // ── Config ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setConfigLoading(true);

    getBookingPageConfig()
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch((error: Error) => {
        if (!cancelled) setConfigError(error.message);
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Google gives us a name; pre-filling it saves the customer a step.
  useEffect(() => {
    if (!user || name) return;
    const googleName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      '';
    if (googleName) setName(googleName);
  }, [user, name]);

  const selectedService = useMemo(
    () => config?.services?.find((service) => service.id === serviceId) ?? null,
    [config, serviceId],
  );

  /**
   * Slot length follows the picked service when the owner allows it, because a
   * bed frame and a nightstand do not take the same amount of the day.
   */
  const durationMinutes = useMemo(() => {
    if (config?.use_service_duration && selectedService?.duration_minutes) {
      return selectedService.duration_minutes;
    }
    return config?.default_duration_minutes ?? 120;
  }, [config, selectedService]);

  // ── Slots for the visible month ───────────────────────────────────────────
  const loadSlots = useCallback(async () => {
    if (!config?.is_enabled) return;

    setSlotsLoading(true);
    try {
      const from = toDateKey(visibleMonth);
      const to = toDateKey(monthEnd(visibleMonth));
      setSlots(await getAvailableSlots(from, to, durationMinutes));
      setSlotError('');
    } catch (error) {
      setSlotError((error as Error).message);
    } finally {
      setSlotsLoading(false);
    }
  }, [config, visibleMonth, durationMinutes]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, BookingSlot[]>();
    slots.forEach((slot) => {
      const existing = grouped.get(slot.slot_date);
      if (existing) existing.push(slot);
      else grouped.set(slot.slot_date, [slot]);
    });
    return grouped;
  }, [slots]);

  // A day that lost its last slot (someone else booked it) must not stay selected.
  useEffect(() => {
    if (selectedDate && !slotsByDate.has(selectedDate)) {
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }, [slotsByDate, selectedDate]);

  useEffect(() => {
    if (selectedDate) revealStep(timesRef.current);
  }, [selectedDate]);

  useEffect(() => {
    if (selectedSlot) revealStep(detailsRef.current);
  }, [selectedSlot]);

  const handleSignIn = async () => {
    setSigningIn(true);
    const { error } = await signInWithGoogleForBooking();
    if (error) {
      setConfigError(error.message);
      setSigningIn(false);
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';

    const oversized = picked.find((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized) {
      setSubmitError(`${oversized.name} is larger than 10 MB.`);
      return;
    }

    setSubmitError('');
    setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSlot || !config) return;

    if (config.collect_phone === 'required' && !phone.trim()) {
      setSubmitError('A phone number is required.');
      return;
    }

    if (config.collect_address === 'required' && !address.trim()) {
      setSubmitError('A service address is required.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      let photoPaths: string[] = [];
      if (config.collect_photos && photos.length > 0) {
        photoPaths = await uploadBookingPhotos('bookings', photos);
      }

      const booking = await createBooking({
        bookingDate: selectedSlot.slot_date,
        startTime: selectedSlot.start_time,
        customerName: name.trim(),
        serviceId: config.collect_service_type && serviceId ? serviceId : null,
        pieces: config.collect_pieces ? Number(pieces) || 1 : null,
        customerPhone: phone.trim() || null,
        serviceAddress: address.trim() || null,
        notes: notes.trim() || null,
        photoPaths,
      });

      setResult(booking);
    } catch (error) {
      setSubmitError((error as Error).message);
      // Someone may have taken the slot while the form was open, so refresh.
      void loadSlots();
    } finally {
      setSubmitting(false);
    }
  };

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (!hydrated || authLoading) {
    return <CenteredMessage icon={<Loader2 className="w-6 h-6 animate-spin" />} title="Loading…" />;
  }

  if (!user) {
    return <SignInGate onSignIn={handleSignIn} busy={signingIn} error={configError} />;
  }

  if (configLoading && !config) {
    return (
      <CenteredMessage
        icon={<Loader2 className="w-6 h-6 animate-spin" />}
        title="Checking availability…"
      />
    );
  }

  if (configError && !config) {
    return (
      <CenteredMessage
        icon={<AlertCircle className="w-6 h-6 text-red-500" />}
        title="Something went wrong"
        body={configError}
      />
    );
  }

  if (!config?.is_enabled) {
    return (
      <CenteredMessage
        icon={<CalendarDays className="w-6 h-6 text-slate-400" />}
        title="Online booking is closed right now"
        body="Get in touch and we will find you a time."
        action={
          <Link
            to="/contact"
            className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
          >
            Contact us
          </Link>
        }
      />
    );
  }

  if (result) {
    return <BookingConfirmation result={result} config={config} />;
  }

  // ── Booking flow ──────────────────────────────────────────────────────────
  const daySlots = selectedDate ? slotsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {config.business_name ?? 'the site'}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{config.page_heading}</h1>
          <p className="text-slate-600 mt-2">{config.page_intro}</p>
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Times shown in {config.timezone?.replace(/_/g, ' ')} ·{' '}
            {formatDurationLabel(durationMinutes)} visit
          </p>
        </header>

        {/* Service picker first: it can change how long a slot needs to be. */}
        {config.collect_service_type && (config.services?.length ?? 0) > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <label
              className="block text-sm font-semibold text-slate-900 mb-2"
              htmlFor="booking-service"
            >
              What do you need built?
            </label>
            <select
              id="booking-service"
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setSelectedSlot(null);
              }}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">Not sure yet / something else</option>
              {config.services?.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                  {service.duration_minutes
                    ? ` — about ${formatDurationLabel(service.duration_minutes)}`
                    : ''}
                </option>
              ))}
            </select>
            {selectedService?.duration_minutes ? (
              <p className="text-xs text-slate-500 mt-2">
                We will hold {formatDurationLabel(selectedService.duration_minutes)} for this.
              </p>
            ) : null}
          </section>
        )}

        <section className="bg-white rounded-xl border border-slate-200 mb-6">
          <MonthNavigator
            visibleMonth={visibleMonth}
            today={config.today}
            maxAdvanceDays={config.max_advance_days ?? 60}
            onChange={(next) => {
              setVisibleMonth(next);
              setSelectedDate(null);
              setSelectedSlot(null);
            }}
          />

          <CalendarGrid
            visibleMonth={visibleMonth}
            slotsByDate={slotsByDate}
            selectedDate={selectedDate}
            loading={slotsLoading}
            onSelect={(date) => {
              setSelectedDate(date);
              setSelectedSlot(null);
            }}
          />

          {slotError && (
            <div className="mx-4 mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">
                We could not load open times just now. {slotError}
              </p>
            </div>
          )}
        </section>

        {selectedDate && (
          <section
            ref={timesRef}
            className="bg-white rounded-xl border border-slate-200 p-5 mb-6 scroll-mt-4"
          >
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Start times on {formatDateLabel(selectedDate)}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {daySlots.map((slot) => {
                const active = selectedSlot?.start_time === slot.start_time;
                return (
                  <button
                    key={slot.start_time}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    {formatTimeLabel(slot.start_time)}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {selectedSlot && (
          <form
            ref={detailsRef}
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-slate-200 p-5 scroll-mt-4"
          >
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 mb-5">
              <CalendarCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  {formatDateLabel(selectedSlot.slot_date)}
                </p>
                <p className="text-sm text-emerald-800">
                  {formatTimeLabel(selectedSlot.start_time)} –{' '}
                  {formatTimeLabel(selectedSlot.end_time)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-slate-700 mb-1"
                  htmlFor="booking-name"
                >
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  id="booking-name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <p className="text-xs text-slate-500">
                We will use <span className="font-medium">{user.email}</span> to reach you — that is
                the account you signed in with.
              </p>

              {config.collect_phone !== 'off' && (
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="booking-phone"
                  >
                    Phone{' '}
                    {config.collect_phone === 'required' ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-slate-400">(optional)</span>
                    )}
                  </label>
                  <input
                    id="booking-phone"
                    type="tel"
                    required={config.collect_phone === 'required'}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {config.collect_address !== 'off' && (
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="booking-address"
                  >
                    Where is the work?{' '}
                    {config.collect_address === 'required' ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-slate-400">(optional)</span>
                    )}
                  </label>
                  <input
                    id="booking-address"
                    type="text"
                    required={config.collect_address === 'required'}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {config.collect_pieces && (
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="booking-pieces"
                  >
                    How many pieces?
                  </label>
                  <input
                    id="booking-pieces"
                    type="number"
                    min={1}
                    max={99}
                    value={pieces}
                    onChange={(event) => setPieces(event.target.value)}
                    className="w-28 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {config.collect_notes && (
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="booking-notes"
                  >
                    Anything we should know? <span className="text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="booking-notes"
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Stairs, parking, the brand, a deadline…"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {config.collect_photos && (
                <div>
                  <span className="block text-sm font-medium text-slate-700 mb-1">
                    Photos <span className="text-slate-400">(optional, up to {MAX_PHOTOS})</span>
                  </span>
                  <p className="text-xs text-slate-500 mb-2">
                    A photo of the box or the label helps us bring the right tools.
                  </p>

                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {photoPreviews.map((preview, index) => (
                        <div
                          key={`${preview.file.name}-${index}`}
                          className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200"
                        >
                          <img
                            src={preview.url}
                            alt={preview.file.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPhotos((current) => current.filter((_, i) => i !== index))
                            }
                            className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                            aria-label={`Remove ${preview.file.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {photos.length < MAX_PHOTOS && (
                    <label className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                      <Camera className="w-4 h-4" />
                      Add a photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        multiple
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            {submitError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Booking…
                </>
              ) : (
                <>
                  <CalendarCheck className="w-5 h-5" />
                  {config.require_approval ? 'Request this time' : 'Book this time'}
                </>
              )}
            </button>

            {config.require_approval && (
              <p className="text-xs text-slate-500 text-center mt-2">
                We will hold this slot while we confirm it with you by email.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

/**
 * Short timezone name as a reader would say it — "CDT", not "America/Chicago".
 * Resolved through Intl so it follows daylight saving without a lookup table.
 */
function timezoneLabel(timezone?: string): string | null {
  if (!timezone) return null;
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value ?? null
    );
  } catch {
    // An unrecognised zone should cost a phrase, not the page.
    return null;
  }
}

function hoursLabel(hours?: number): string {
  if (!hours || hours <= 0) return 'no notice';
  if (hours === 24) return 'a day';
  if (hours === 48) return 'two days';
  if (hours % 24 === 0) return `${hours / 24} days`;
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center"
      >
        {number}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-600 mt-0.5">{children}</p>
      </div>
    </li>
  );
}

/**
 * What a visitor sees at /book before signing in.
 *
 * This used to be a bare "Sign in to see open times" card, which asked someone
 * to hand over a Google account before telling them anything: not how far ahead
 * they could book, not that each request is confirmed by hand, not even whether
 * booking was open. Everything here comes from `get_booking_public_info()`, the
 * one booking function `anon` may call, so the copy tracks the real settings
 * instead of drifting from them.
 */
function SignInGate({
  onSignIn,
  busy,
  error,
}: {
  onSignIn: () => void;
  busy: boolean;
  error: string;
}) {
  const info = useBookingPublicInfo();

  // Not known yet. Better a brief spinner than a page that promises booking and
  // then takes it away, or an empty frame where the explanation should be.
  if (!info) {
    return <CenteredMessage icon={<Loader2 className="w-6 h-6 animate-spin" />} title="Loading…" />;
  }

  // The closed state now lands *before* the sign-in, not after it. Asking for a
  // Google account and then saying "we're closed" was the worst version of this.
  if (!info.is_enabled) {
    return (
      <CenteredMessage
        icon={<CalendarDays className="w-6 h-6 text-slate-400" />}
        title="Online booking is closed right now"
        body="We're not taking self-serve bookings at the moment, but we'd still like to hear about your project — send a message and we'll come back with dates."
        action={
          <Link
            to="/contact"
            className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
          >
            Get in touch
          </Link>
        }
      />
    );
  }

  const zone = timezoneLabel(info.timezone);

  // Only promise to ask for what the form is actually configured to collect.
  const bringAlong = [
    info.collect_service_type && 'What kind of work it is — assembly, TV mounting, or something else',
    info.collect_pieces && 'Roughly how many pieces there are',
    info.collect_photos && 'Photos of the boxes or the space, if you have them handy',
    info.collect_address === 'required' && 'The address where the work happens',
    info.collect_phone === 'required' && 'A phone number for build-day questions',
  ].filter((item): item is string => typeof item === 'string');

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Boxed2Built
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {info.page_heading || 'Book your assembly'}
            </h1>
            {info.page_intro && <p className="text-slate-600 mt-2">{info.page_intro}</p>}
          </div>

          <div className="p-6 sm:p-8 border-b border-slate-100">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
              How it works
            </h2>
            <ol className="space-y-4">
              <Step number={1} title="Pick a day and a start time">
                The calendar only shows times we're actually free, so anything you can click is a
                real opening{zone ? ` — all times ${zone}` : ''}.
              </Step>
              <Step number={2} title="Tell us about the job">
                A few quick details so we show up with the right tools and enough time.
              </Step>
              <Step number={3} title={info.require_approval ? 'We confirm it' : "You're booked"}>
                {info.require_approval
                  ? 'We look over every request and confirm by email, usually the same day. Your slot is held for you in the meantime.'
                  : "Your time is locked in straight away and the confirmation email lands in your inbox."}
              </Step>
            </ol>
          </div>

          {bringAlong.length > 0 && (
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Worth having ready
              </h2>
              <ul className="space-y-2">
                {bringAlong.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-3">
                Nothing here is a commitment — it just makes the estimate accurate.
              </p>
            </div>
          )}

          <div className="p-6 sm:p-8 border-b border-slate-100 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Notice needed
              </p>
              <p className="text-sm text-slate-700">
                Book at least {hoursLabel(info.min_lead_time_hours)} ahead.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                How far ahead
              </p>
              <p className="text-sm text-slate-700">
                The calendar runs {info.max_advance_days ?? 60} days out.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Changed your mind
              </p>
              <p className="text-sm text-slate-700">
                Cancel up to {hoursLabel(info.cancellation_cutoff_hours)} before.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 border-b border-slate-100">
            <p className="text-sm text-slate-600">
              We work across {SERVICE_AREAS.slice(0, 4).join(', ')} and nearby.{' '}
              <Link to="/service-areas" className="text-emerald-700 underline hover:text-emerald-800">
                See the full service area
              </Link>
              .
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={onSignIn}
              disabled={busy}
              className="w-full px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {busy ? 'Redirecting…' : 'Continue with Google to see open times'}
            </button>

            <p className="text-xs text-slate-500 mt-3 flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
              Signing in is how we know the booking is really yours — it holds your slot and lets you
              cancel or check it later. Nothing is posted anywhere.
            </p>

            <Link
              to="/contact"
              className="block mt-5 text-sm text-center text-slate-600 hover:text-emerald-700 underline"
            >
              Rather just send a message?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthNavigator({
  visibleMonth,
  today,
  maxAdvanceDays,
  onChange,
}: {
  visibleMonth: Date;
  today?: string;
  maxAdvanceDays: number;
  onChange: (next: Date) => void;
}) {
  const now = today ? new Date(`${today}T00:00:00`) : new Date();
  const firstAllowed = monthStart(now);
  const lastAllowed = monthStart(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + maxAdvanceDays),
  );

  const canGoBack = visibleMonth > firstAllowed;
  const canGoForward = visibleMonth < lastAllowed;

  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-200">
      <button
        type="button"
        onClick={() => onChange(monthStart(visibleMonth, -1))}
        disabled={!canGoBack}
        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <h2 className="text-base font-semibold text-slate-900">
        {visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </h2>

      <button
        type="button"
        onClick={() => onChange(monthStart(visibleMonth, 1))}
        disabled={!canGoForward}
        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Next month"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function CalendarGrid({
  visibleMonth,
  slotsByDate,
  selectedDate,
  loading,
  onSelect,
}: {
  visibleMonth: Date;
  slotsByDate: Map<string, BookingSlot[]>;
  selectedDate: string | null;
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  const daysInMonth = monthEnd(visibleMonth).getDate();
  const leadingBlanks = visibleMonth.getDay();

  const cells: Array<{ key: string; date: string | null; day: number | null }> = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ key: `blank-${i}`, date: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
    cells.push({ key: date, date, day });
  }

  const openDays = slotsByDate.size;

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="text-center text-xs font-semibold text-slate-500 py-1"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.date) return <div key={cell.key} />;

          const available = slotsByDate.get(cell.date);
          const isSelected = selectedDate === cell.date;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={!available}
              onClick={() => onSelect(cell.date as string)}
              className={`aspect-square rounded-lg text-sm font-medium transition-colors flex flex-col items-center justify-center gap-0.5 ${
                isSelected
                  ? 'bg-emerald-600 text-white'
                  : available
                    ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                    : 'text-slate-300 cursor-not-allowed'
              }`}
              aria-label={
                available
                  ? `${formatDateLabel(cell.date)}, ${available.length} times open`
                  : `${formatDateLabel(cell.date)}, unavailable`
              }
            >
              {cell.day}
              {available && (
                <span
                  className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 mt-4 text-center">
        {loading
          ? 'Checking what is open…'
          : openDays === 0
            ? 'Nothing open this month — try the next one.'
            : `${openDays} day${openDays === 1 ? '' : 's'} open this month`}
      </p>
    </div>
  );
}

function BookingConfirmation({
  result,
  config,
}: {
  result: CreateBookingResult;
  config: BookingPageConfig;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">
          {result.status === 'confirmed' ? "You're booked" : 'Your time is held'}
        </h1>
        <p className="text-sm text-slate-600 mb-6">{result.confirmation_message}</p>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-left space-y-1 mb-6">
          <p className="text-sm font-semibold text-slate-900">
            {formatDateLabel(result.booking_date)}
          </p>
          <p className="text-sm text-slate-700">
            {formatTimeLabel(result.start_time)} – {formatTimeLabel(result.end_time)}
          </p>
          <p className="text-xs text-slate-500 pt-2">
            Reference <span className="font-mono font-semibold">{result.reference}</span>
          </p>
        </div>

        {config.cancellation_cutoff_hours ? (
          <p className="text-xs text-slate-500 mb-6">
            Need to change it? Call us at least {config.cancellation_cutoff_hours} hours before.
          </p>
        ) : null}

        <Link
          to="/"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
        >
          Done
        </Link>
      </div>
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-500">
          {icon}
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {body && <p className="text-sm text-slate-600 mt-2">{body}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
