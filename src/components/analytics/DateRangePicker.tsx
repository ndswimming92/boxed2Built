import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}

type ShortcutKey =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'current_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'current_year'
  | 'all_time';

interface Shortcut {
  key: ShortcutKey;
  label: string;
  build: () => DateRangeValue;
}

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addMonths = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const formatRangeLabel = (range: DateRangeValue): string => {
  if (range.label === 'All Time') return 'All Time';
  if (!range.startDate || !range.endDate) return 'Select dates';

  const s = range.startDate;
  const e = range.endDate;
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  if (isSameDay(s, e)) {
    return `${SHORT_MONTHS[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
  }
  if (sameMonth) {
    return `${SHORT_MONTHS[s.getMonth()]} ${s.getDate()} \u2013 ${e.getDate()}, ${s.getFullYear()}`;
  }
  if (sameYear) {
    return `${SHORT_MONTHS[s.getMonth()]} ${s.getDate()} \u2013 ${SHORT_MONTHS[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${SHORT_MONTHS[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} \u2013 ${SHORT_MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
};

const buildShortcuts = (): Shortcut[] => {
  const now = new Date();

  return [
    {
      key: 'today',
      label: 'Today',
      build: () => ({
        startDate: startOfDay(now),
        endDate: endOfDay(now),
        label: 'Today',
      }),
    },
    {
      key: 'last_7_days',
      label: 'Last 7 Days',
      build: () => {
        const start = startOfDay(now);
        start.setDate(start.getDate() - 6);
        return { startDate: start, endDate: endOfDay(now), label: 'Last 7 Days' };
      },
    },
    {
      key: 'last_30_days',
      label: 'Last 30 Days',
      build: () => {
        const start = startOfDay(now);
        start.setDate(start.getDate() - 29);
        return { startDate: start, endDate: endOfDay(now), label: 'Last 30 Days' };
      },
    },
    {
      key: 'current_month',
      label: 'This Month',
      build: () => {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: startOfDay(start), endDate: endOfDay(now), label: 'This Month' };
      },
    },
    {
      key: 'last_3_months',
      label: 'Last 3 Months',
      build: () => {
        const start = addMonths(now, -3);
        return { startDate: startOfDay(start), endDate: endOfDay(now), label: 'Last 3 Months' };
      },
    },
    {
      key: 'last_6_months',
      label: 'Last 6 Months',
      build: () => {
        const start = addMonths(now, -6);
        return { startDate: startOfDay(start), endDate: endOfDay(now), label: 'Last 6 Months' };
      },
    },
    {
      key: 'current_year',
      label: 'This Year',
      build: () => {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return { startDate: startOfDay(start), endDate: endOfDay(end), label: 'This Year' };
      },
    },
    {
      key: 'all_time',
      label: 'All Time',
      build: () => ({ startDate: null, endDate: null, label: 'All Time' }),
    },
  ];
};

interface CalendarMonthProps {
  viewDate: Date;
  startDate: Date | null;
  endDate: Date | null;
  hoverDate: Date | null;
  onSelect: (date: Date) => void;
  onHover: (date: Date | null) => void;
  maxDate: Date;
}

function CalendarMonth({ viewDate, startDate, endDate, hoverDate, onSelect, onHover, maxDate }: CalendarMonthProps) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const rangeEnd = endDate ?? hoverDate;

  return (
    <div className="flex-1 min-w-0">
      <div className="text-center text-sm font-semibold text-slate-900 mb-3">
        {MONTH_NAMES[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((w, idx) => (
          <div key={idx} className="text-[11px] font-medium text-slate-400 text-center py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={idx} />;
          const cellTime = cell.getTime();
          const disabled = cellTime > maxDate.getTime();
          const isStart = startDate && isSameDay(cell, startDate);
          const isEnd = endDate && isSameDay(cell, endDate);
          const inRange =
            startDate && rangeEnd
              ? cellTime >= startOfDay(startDate).getTime() && cellTime <= endOfDay(rangeEnd).getTime()
              : false;
          const isPreviewEnd = !endDate && hoverDate && isSameDay(cell, hoverDate);

          let classes =
            'text-xs sm:text-sm h-8 w-full max-w-[36px] mx-auto flex items-center justify-center rounded-md transition-colors';
          if (disabled) {
            classes += ' text-slate-300 cursor-not-allowed';
          } else if (isStart || isEnd) {
            classes += ' bg-emerald-600 text-white font-semibold shadow-sm';
          } else if (inRange) {
            classes += ' bg-emerald-100 text-emerald-900';
          } else if (isPreviewEnd) {
            classes += ' ring-2 ring-emerald-400 text-slate-900';
          } else {
            classes += ' text-slate-700 hover:bg-slate-100';
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(cell)}
              onMouseEnter={() => !disabled && onHover(cell)}
              onMouseLeave={() => onHover(null)}
              className={classes}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | null>(value.startDate);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value.endDate);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const base = value.startDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const shortcuts = useMemo(() => buildShortcuts(), []);
  const maxDate = useMemo(() => endOfDay(new Date()), []);

  useEffect(() => {
    if (!open) return;
    setDraftStart(value.startDate);
    setDraftEnd(value.endDate);
    setStartInput(value.startDate ? formatInput(value.startDate) : '');
    setEndInput(value.endDate ? formatInput(value.endDate) : '');
    setInputError(null);
    const base = value.startDate ?? new Date();
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, value.startDate, value.endDate]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleDayClick = (date: Date) => {
    if (!draftStart || (draftStart && draftEnd)) {
      const next = startOfDay(date);
      setDraftStart(next);
      setDraftEnd(null);
      setStartInput(formatInput(next));
      setEndInput('');
      setInputError(null);
      return;
    }
    if (date.getTime() < draftStart.getTime()) {
      const next = startOfDay(date);
      setDraftStart(next);
      setDraftEnd(null);
      setStartInput(formatInput(next));
      setEndInput('');
      return;
    }
    const end = endOfDay(date);
    setDraftEnd(end);
    setEndInput(formatInput(end));
    setInputError(null);
  };

  const handleShortcut = (shortcut: Shortcut) => {
    const range = shortcut.build();
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    setStartInput(range.startDate ? formatInput(range.startDate) : '');
    setEndInput(range.endDate ? formatInput(range.endDate) : '');
    setInputError(null);
    if (range.startDate) {
      setViewDate(new Date(range.startDate.getFullYear(), range.startDate.getMonth(), 1));
    }
    onChange(range);
    setOpen(false);
  };

  const applyTypedInputs = () => {
    if (!startInput && !endInput) {
      setInputError(null);
      return;
    }
    const parsedStart = parseInput(startInput);
    const parsedEnd = parseInput(endInput);
    if (startInput && !parsedStart) {
      setInputError('Invalid start date. Use MM/DD/YYYY.');
      return;
    }
    if (endInput && !parsedEnd) {
      setInputError('Invalid end date. Use MM/DD/YYYY.');
      return;
    }
    if (parsedStart && parsedEnd && parsedStart.getTime() > parsedEnd.getTime()) {
      setInputError('Start date must be before end date.');
      return;
    }
    setInputError(null);
    setDraftStart(parsedStart ? startOfDay(parsedStart) : null);
    setDraftEnd(parsedEnd ? endOfDay(parsedEnd) : null);
  };

  const canApply = Boolean(draftStart && draftEnd) && !inputError;

  const handleApply = () => {
    if (!canApply || !draftStart || !draftEnd) return;
    onChange({
      startDate: draftStart,
      endDate: draftEnd,
      label: formatRangeLabel({ startDate: draftStart, endDate: draftEnd, label: 'Custom' }),
    });
    setOpen(false);
  };

  const handleClear = () => {
    setDraftStart(null);
    setDraftEnd(null);
    setStartInput('');
    setEndInput('');
    setInputError(null);
  };

  const triggerLabel = formatRangeLabel(value);
  const secondMonth = addMonths(viewDate, 1);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 min-w-[180px] sm:min-w-[240px] justify-between text-sm sm:text-base"
      >
        <span className="flex items-center gap-2 truncate">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,740px)] sm:w-[740px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <div className="sm:w-40 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2 px-2">
                Quick Ranges
              </p>
              <div className="flex sm:flex-col flex-wrap gap-1">
                {shortcuts.map(shortcut => (
                  <button
                    key={shortcut.key}
                    type="button"
                    onClick={() => handleShortcut(shortcut)}
                    className="text-left text-sm px-2 py-1.5 rounded-md text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-900">Select a date range</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Start</label>
                  <input
                    type="text"
                    value={startInput}
                    placeholder="MM/DD/YYYY"
                    onChange={e => setStartInput(e.target.value)}
                    onBlur={applyTypedInputs}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">End</label>
                  <input
                    type="text"
                    value={endInput}
                    placeholder="MM/DD/YYYY"
                    onChange={e => setEndInput(e.target.value)}
                    onBlur={applyTypedInputs}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {inputError && (
                <p className="text-xs text-red-600 mb-2">{inputError}</p>
              )}

              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setViewDate(addMonths(viewDate, -1))}
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <CalendarMonth
                  viewDate={viewDate}
                  startDate={draftStart}
                  endDate={draftEnd}
                  hoverDate={hoverDate}
                  onSelect={handleDayClick}
                  onHover={setHoverDate}
                  maxDate={maxDate}
                />
                <div className="hidden sm:block">
                  <CalendarMonth
                    viewDate={secondMonth}
                    startDate={draftStart}
                    endDate={draftEnd}
                    hoverDate={hoverDate}
                    onSelect={handleDayClick}
                    onHover={setHoverDate}
                    maxDate={maxDate}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Clear
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-1.5 text-sm text-slate-700 rounded-md hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!canApply}
                    className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatInput(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}/${date.getFullYear()}`;
}

function parseInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}
