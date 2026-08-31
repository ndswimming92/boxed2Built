import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CalendarOff,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';
import { supabase, BookingDateOverride, BookingSettings } from '../../lib/supabase';
import {
  AvailabilityWindowInput,
  WEEKDAY_LABELS,
  deleteDateOverride,
  ensureBookingSettings,
  formatDateLabel,
  getAvailabilityRules,
  getDateOverrides,
  replaceAvailabilityRules,
  saveDateOverride,
  toDateKey,
  updateBookingSettings,
} from '../../services/bookingService';

type Feedback = { type: 'success' | 'error'; text: string };

/** A weekday's bookable windows, as edited in the grid. */
type DayWindows = {
  enabled: boolean;
  windows: Array<{ start: string; end: string }>;
};

const DEFAULT_WINDOW = { start: '09:00', end: '17:00' };

const emptyWeek = (): DayWindows[] =>
  WEEKDAY_LABELS.map(() => ({ enabled: false, windows: [] }));

/** '09:00:00' from Postgres, '09:00' from an <input type="time">. */
const toInputTime = (value: string): string => value.slice(0, 5);

export default function BookingAvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [week, setWeek] = useState<DayWindows[]>(emptyWeek());
  const [overrides, setOverrides] = useState<BookingDateOverride[]>([]);
  const [copied, setCopied] = useState(false);

  const [overrideDate, setOverrideDate] = useState('');
  const [overrideBlocked, setOverrideBlocked] = useState(true);
  const [overrideStart, setOverrideStart] = useState('10:00');
  const [overrideEnd, setOverrideEnd] = useState('14:00');
  const [overrideNote, setOverrideNote] = useState('');

  const bookingUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/book';
    return `${window.location.origin}/book`;
  }, []);

  const flash = useCallback((next: Feedback) => {
    setMessage(next);
    setTimeout(() => setMessage(null), 6000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id, organization_id')
        .eq('is_active', true)
        .maybeSingle();

      if (!businessInfo) {
        flash({ type: 'error', text: 'No active business found.' });
        return;
      }

      setBusinessId(businessInfo.id);
      setOrganizationId(businessInfo.organization_id ?? null);

      const [loadedSettings, rules, loadedOverrides] = await Promise.all([
        ensureBookingSettings(businessInfo.id, businessInfo.organization_id ?? null),
        getAvailabilityRules(businessInfo.id),
        getDateOverrides(businessInfo.id, toDateKey(new Date())),
      ]);

      setSettings(loadedSettings);
      setOverrides(loadedOverrides);

      const nextWeek = emptyWeek();
      rules
        .filter((rule) => rule.is_active)
        .forEach((rule) => {
          const day = nextWeek[rule.day_of_week];
          if (!day) return;
          day.enabled = true;
          day.windows.push({
            start: toInputTime(rule.start_time),
            end: toInputTime(rule.end_time),
          });
        });
      setWeek(nextWeek);
    } catch (error) {
      flash({ type: 'error', text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const patchSettings = (patch: Partial<BookingSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  };

  const toggleDay = (dayIndex: number, enabled: boolean) => {
    setWeek((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day;
        // Turning a day on with no windows yet gives it a sensible one to edit
        // rather than an empty row that silently saves as "closed".
        return {
          enabled,
          windows: enabled && day.windows.length === 0 ? [{ ...DEFAULT_WINDOW }] : day.windows,
        };
      }),
    );
  };

  const updateWindow = (
    dayIndex: number,
    windowIndex: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setWeek((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              windows: day.windows.map((window, wIndex) =>
                wIndex === windowIndex ? { ...window, [field]: value } : window,
              ),
            }
          : day,
      ),
    );
  };

  const addWindow = (dayIndex: number) => {
    setWeek((current) =>
      current.map((day, index) =>
        index === dayIndex ? { ...day, windows: [...day.windows, { ...DEFAULT_WINDOW }] } : day,
      ),
    );
  };

  const removeWindow = (dayIndex: number, windowIndex: number) => {
    setWeek((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? { ...day, windows: day.windows.filter((_, wIndex) => wIndex !== windowIndex) }
          : day,
      ),
    );
  };

  const handleSave = async () => {
    if (!businessId || !settings) return;

    // A window that ends before it starts would be rejected by the check
    // constraint with a message nobody can act on, so it is caught here.
    for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
      const day = week[dayIndex];
      if (!day.enabled) continue;

      for (const window of day.windows) {
        if (window.end <= window.start) {
          flash({
            type: 'error',
            text: `${WEEKDAY_LABELS[dayIndex]}: ${window.end} is not after ${window.start}.`,
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const windows: AvailabilityWindowInput[] = [];
      week.forEach((day, dayIndex) => {
        if (!day.enabled) return;
        day.windows.forEach((window) => {
          windows.push({
            day_of_week: dayIndex,
            start_time: window.start,
            end_time: window.end,
            is_active: true,
          });
        });
      });

      await Promise.all([
        updateBookingSettings(settings.id, {
          is_enabled: settings.is_enabled,
          timezone: settings.timezone,
          page_heading: settings.page_heading,
          page_intro: settings.page_intro,
          confirmation_message: settings.confirmation_message,
          default_duration_minutes: settings.default_duration_minutes,
          slot_interval_minutes: settings.slot_interval_minutes,
          use_service_duration: settings.use_service_duration,
          buffer_minutes: settings.buffer_minutes,
          min_lead_time_hours: settings.min_lead_time_hours,
          max_advance_days: settings.max_advance_days,
          max_bookings_per_day: settings.max_bookings_per_day,
          max_active_bookings_per_customer: settings.max_active_bookings_per_customer,
          cancellation_cutoff_hours: settings.cancellation_cutoff_hours,
          block_on_scheduled_jobs: settings.block_on_scheduled_jobs,
          job_block_mode: settings.job_block_mode,
          require_approval: settings.require_approval,
          collect_service_type: settings.collect_service_type,
          collect_pieces: settings.collect_pieces,
          collect_photos: settings.collect_photos,
          collect_phone: settings.collect_phone,
          collect_address: settings.collect_address,
          collect_notes: settings.collect_notes,
          notify_email: settings.notify_email,
        }),
        replaceAvailabilityRules(businessId, organizationId, windows),
      ]);

      flash({ type: 'success', text: 'Booking availability saved.' });
      await loadData();
    } catch (error) {
      flash({ type: 'error', text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!businessId || !overrideDate) {
      flash({ type: 'error', text: 'Pick a date first.' });
      return;
    }

    if (!overrideBlocked && overrideEnd <= overrideStart) {
      flash({ type: 'error', text: 'The end time must be after the start time.' });
      return;
    }

    try {
      await saveDateOverride(businessId, organizationId, {
        override_date: overrideDate,
        is_blocked: overrideBlocked,
        start_time: overrideStart,
        end_time: overrideEnd,
        note: overrideNote.trim() || null,
      });

      setOverrideDate('');
      setOverrideNote('');
      setOverrides(await getDateOverrides(businessId, toDateKey(new Date())));
      flash({ type: 'success', text: 'Date exception saved.' });
    } catch (error) {
      flash({ type: 'error', text: (error as Error).message });
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!businessId) return;

    try {
      await deleteDateOverride(id);
      setOverrides(await getDateOverrides(businessId, toDateKey(new Date())));
    } catch (error) {
      flash({ type: 'error', text: (error as Error).message });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      flash({ type: 'error', text: 'Could not copy the link. Select and copy it manually.' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="max-w-4xl">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">
            Booking settings could not be loaded. Make sure an active business exists under Business
            Info.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
          Booking Availability
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Control the times customers can book on your public booking page.
        </p>
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
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* ── The link ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            Your booking link
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Send this to a customer who asks what dates you have. They sign in with Google, then see
            only the times below.
          </p>
        </div>

        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              readOnly
              value={bookingUrl}
              onFocus={(event) => event.target.select()}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Preview
            </a>
          </div>

          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.is_enabled}
              onChange={(event) => patchSettings({ is_enabled: event.target.checked })}
              className="w-4 h-4 mt-0.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
            />
            <span>
              <span className="text-sm font-medium text-slate-900">Booking page is live</span>
              <span className="block text-xs text-slate-600">
                Turn this off to close bookings without losing any of your settings. Existing
                bookings are unaffected.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ── Weekly schedule ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Weekly availability
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Separate from your Business Hours, which stay as your Google listing. Add a second
            window to a day to keep a lunch break clear.
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          {week.map((day, dayIndex) => (
            <div
              key={WEEKDAY_LABELS[dayIndex]}
              className={`rounded-lg border p-4 transition-colors ${
                day.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) => toggleDay(dayIndex, event.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="font-medium text-slate-900 w-24">
                    {WEEKDAY_LABELS[dayIndex]}
                  </span>
                </label>

                {day.enabled ? (
                  <button
                    type="button"
                    onClick={() => addWindow(dayIndex)}
                    className="text-sm text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add window
                  </button>
                ) : (
                  <span className="text-sm text-slate-400">Not bookable</span>
                )}
              </div>

              {day.enabled && (
                <div className="mt-3 space-y-2 pl-7">
                  {day.windows.map((window, windowIndex) => (
                    <div key={windowIndex} className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <input
                        type="time"
                        value={window.start}
                        onChange={(event) =>
                          updateWindow(dayIndex, windowIndex, 'start', event.target.value)
                        }
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-slate-500 text-sm">to</span>
                      <input
                        type="time"
                        value={window.end}
                        onChange={(event) =>
                          updateWindow(dayIndex, windowIndex, 'end', event.target.value)
                        }
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                      {day.windows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWindow(dayIndex, windowIndex)}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          aria-label="Remove window"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Date exceptions ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-emerald-600" />
            Specific dates
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Take a day off, or open one that is not normally bookable. An exception always beats the
            weekly schedule for that date.
          </p>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="override-date">
                Date
              </label>
              <input
                id="override-date"
                type="date"
                value={overrideDate}
                min={toDateKey(new Date())}
                onChange={(event) => setOverrideDate(event.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="override-kind">
                What happens
              </label>
              <select
                id="override-kind"
                value={overrideBlocked ? 'blocked' : 'custom'}
                onChange={(event) => setOverrideBlocked(event.target.value === 'blocked')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="blocked">Not available all day</option>
                <option value="custom">Available these hours instead</option>
              </select>
            </div>

            {!overrideBlocked && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="override-start">
                    From
                  </label>
                  <input
                    id="override-start"
                    type="time"
                    value={overrideStart}
                    onChange={(event) => setOverrideStart(event.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="override-end">
                    To
                  </label>
                  <input
                    id="override-end"
                    type="time"
                    value={overrideEnd}
                    onChange={(event) => setOverrideEnd(event.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="override-note">
                Note (only you see this)
              </label>
              <input
                id="override-note"
                type="text"
                value={overrideNote}
                onChange={(event) => setOverrideNote(event.target.value)}
                placeholder="Out of town, family day, catching up on a backlog…"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddOverride}
            className="mt-4 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add exception
          </button>

          {overrides.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4 space-y-2">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {formatDateLabel(override.override_date)}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {override.is_blocked
                        ? 'Not available all day'
                        : `Available ${toInputTime(override.start_time ?? '')} – ${toInputTime(
                            override.end_time ?? '',
                          )}`}
                      {override.note ? ` · ${override.note}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteOverride(override.id)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                    aria-label="Remove exception"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Slot rules ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            How slots are offered
          </h2>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <NumberField
            id="default-duration"
            label="Default job length"
            suffix="minutes"
            help="Used when a customer picks no service, or a service has no duration set."
            value={settings.default_duration_minutes}
            min={15}
            max={1440}
            step={15}
            onChange={(value) => patchSettings({ default_duration_minutes: value })}
          />

          <NumberField
            id="slot-interval"
            label="Start times every"
            suffix="minutes"
            help="30 gives 9:00, 9:30, 10:00. 60 gives 9:00, 10:00."
            value={settings.slot_interval_minutes}
            min={5}
            max={480}
            step={5}
            onChange={(value) => patchSettings({ slot_interval_minutes: value })}
          />

          <NumberField
            id="buffer"
            label="Buffer around each job"
            suffix="minutes"
            help="Travel and setup time kept clear either side of anything booked."
            value={settings.buffer_minutes}
            min={0}
            max={480}
            step={5}
            onChange={(value) => patchSettings({ buffer_minutes: value })}
          />

          <NumberField
            id="lead-time"
            label="Minimum notice"
            suffix="hours"
            help="Nothing inside this window is offered. 24 means no same-day bookings."
            value={settings.min_lead_time_hours}
            min={0}
            max={8760}
            onChange={(value) => patchSettings({ min_lead_time_hours: value })}
          />

          <NumberField
            id="advance-days"
            label="Bookable up to"
            suffix="days ahead"
            help="How far into the future the calendar goes."
            value={settings.max_advance_days}
            min={1}
            max={365}
            onChange={(value) => patchSettings({ max_advance_days: value })}
          />

          <NumberField
            id="per-day"
            label="Most jobs per day"
            suffix="jobs"
            help="Counts bookings plus jobs already scheduled that day."
            value={settings.max_bookings_per_day}
            min={1}
            max={50}
            onChange={(value) => patchSettings({ max_bookings_per_day: value })}
          />

          <NumberField
            id="per-customer"
            label="Most open bookings per customer"
            suffix="bookings"
            help="Stops one account from holding your whole calendar."
            value={settings.max_active_bookings_per_customer}
            min={1}
            max={50}
            onChange={(value) => patchSettings({ max_active_bookings_per_customer: value })}
          />

          <NumberField
            id="cancel-cutoff"
            label="Customers can cancel until"
            suffix="hours before"
            help="Inside this window they have to call you. You can always cancel."
            value={settings.cancellation_cutoff_hours}
            min={0}
            max={8760}
            onChange={(value) => patchSettings({ cancellation_cutoff_hours: value })}
          />

          <div className="sm:col-span-2 space-y-3 border-t border-slate-100 pt-5">
            <CheckboxField
              label="Use the service's own duration when one is set"
              help="A bed frame with a 3-hour duration blocks 3 hours; a nightstand blocks less."
              checked={settings.use_service_duration}
              onChange={(checked) => patchSettings({ use_service_duration: checked })}
            />

            <CheckboxField
              label="Scheduled jobs block booking times"
              help="Keeps the booking page in step with your Jobs calendar."
              checked={settings.block_on_scheduled_jobs}
              onChange={(checked) => patchSettings({ block_on_scheduled_jobs: checked })}
            />

            {settings.block_on_scheduled_jobs && (
              <div className="pl-7">
                <label
                  className="block text-sm font-medium text-slate-700 mb-1"
                  htmlFor="job-block-mode"
                >
                  A scheduled job blocks
                </label>
                <select
                  id="job-block-mode"
                  value={settings.job_block_mode}
                  onChange={(event) =>
                    patchSettings({
                      job_block_mode: event.target.value as BookingSettings['job_block_mode'],
                    })
                  }
                  className="w-full sm:w-96 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="time_window">Only its own hours, plus the buffer</option>
                  <option value="whole_day">The entire day</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  A job with no start time on it always blocks the whole day, whichever you pick —
                  there is no way to tell when you will be busy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Approval and form ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-emerald-600" />
            Approval and the form
          </h2>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <CheckboxField
            label="Require my approval before a booking is confirmed"
            help="On: the slot is held and waits for you in Bookings. Off: it becomes a scheduled job straight away."
            checked={settings.require_approval}
            onChange={(checked) => patchSettings({ require_approval: checked })}
          />

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <CheckboxField
              label="Ask which service they need"
              checked={settings.collect_service_type}
              onChange={(checked) => patchSettings({ collect_service_type: checked })}
            />
            <CheckboxField
              label="Ask how many pieces"
              checked={settings.collect_pieces}
              onChange={(checked) => patchSettings({ collect_pieces: checked })}
            />
            <CheckboxField
              label="Let them attach photos"
              help="Uses the same photo storage as your quote form."
              checked={settings.collect_photos}
              onChange={(checked) => patchSettings({ collect_photos: checked })}
            />
            <CheckboxField
              label="Ask for anything else we should know"
              checked={settings.collect_notes}
              onChange={(checked) => patchSettings({ collect_notes: checked })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <FieldModeSelect
              id="collect-phone"
              label="Phone number"
              value={settings.collect_phone}
              onChange={(value) => patchSettings({ collect_phone: value })}
            />
            <FieldModeSelect
              id="collect-address"
              label="Service address"
              value={settings.collect_address}
              onChange={(value) => patchSettings({ collect_address: value })}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="notify-email">
              Email me new bookings at
            </label>
            <input
              id="notify-email"
              type="email"
              value={settings.notify_email ?? ''}
              onChange={(event) => patchSettings({ notify_email: event.target.value || null })}
              placeholder="Leave blank to use your business contact address"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* ── Page copy ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">What customers read</h2>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="page-heading">
              Heading
            </label>
            <input
              id="page-heading"
              type="text"
              value={settings.page_heading}
              onChange={(event) => patchSettings({ page_heading: event.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="page-intro">
              Intro
            </label>
            <textarea
              id="page-intro"
              rows={2}
              value={settings.page_intro}
              onChange={(event) => patchSettings({ page_intro: event.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-700 mb-1"
              htmlFor="confirmation-message"
            >
              After they book
            </label>
            <textarea
              id="confirmation-message"
              rows={2}
              value={settings.confirmation_message}
              onChange={(event) => patchSettings({ confirmation_message: event.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="timezone">
              Timezone
            </label>
            <input
              id="timezone"
              type="text"
              value={settings.timezone}
              onChange={(event) => patchSettings({ timezone: event.target.value })}
              className="w-full sm:w-96 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              An IANA name such as America/Chicago. Every time on the booking page is shown in this
              zone.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mt-8 flex justify-end sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save availability'}
        </button>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  suffix,
  help,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  suffix?: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isNaN(next)) onChange(next);
          }}
          className="w-28 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
        />
        {suffix && <span className="text-sm text-slate-600">{suffix}</span>}
      </div>
      {help && <p className="text-xs text-slate-500 mt-1">{help}</p>}
    </div>
  );
}

function CheckboxField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="w-4 h-4 mt-0.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 flex-shrink-0"
      />
      <span>
        <span className="text-sm font-medium text-slate-900">{label}</span>
        {help && <span className="block text-xs text-slate-600">{help}</span>}
      </span>
    </label>
  );
}

function FieldModeSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: BookingSettings['collect_phone'];
  onChange: (value: BookingSettings['collect_phone']) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as BookingSettings['collect_phone'])}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
      >
        <option value="off">Do not ask</option>
        <option value="optional">Ask, optional</option>
        <option value="required">Ask, required</option>
      </select>
    </div>
  );
}
