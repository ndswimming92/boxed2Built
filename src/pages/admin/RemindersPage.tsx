import React, { useEffect, useState } from 'react';
import { supabase, JobCompletionReminder } from '../../lib/supabase';
import { Calendar, Bell, CheckCircle, X, Clock, AlertCircle, Filter, Search } from 'lucide-react';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import { useToast } from '../../contexts/ToastContext';

type ReminderWithDetails = JobCompletionReminder & {
  job: any;
  job_completion: any;
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderWithDetails[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<ReminderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'snoozed'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderWithDetails | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [snoozeDate, setSnoozeDate] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSnoozing, setIsSnoozing] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissReminderId, setDismissReminderId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reminders, searchTerm, statusFilter]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('job_completion_reminders')
        .select(`
          *,
          job:jobs!job_id (*),
          job_completion:job_completions!job_completion_id (*)
        `)
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.error('Error fetching reminders:', error);
        throw error;
      }

      if (data) {
        setReminders(data);
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reminders];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(reminder =>
        reminder.job?.client_name?.toLowerCase().includes(term) ||
        reminder.admin_notes?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    setFilteredReminders(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isOverdue = (reminder: ReminderWithDetails) => {
    if (reminder.status !== 'pending') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDate = new Date(reminder.scheduled_date);
    scheduledDate.setHours(0, 0, 0, 0);
    return scheduledDate < today;
  };

  const isToday = (reminder: ReminderWithDetails) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDate = new Date(reminder.scheduled_date);
    scheduledDate.setHours(0, 0, 0, 0);
    return scheduledDate.getTime() === today.getTime();
  };

  const handleCompleteReminder = async (reminderId: string) => {
    setIsCompleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('job_completion_reminders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id || null,
          outcome_notes: outcomeNotes,
        })
        .eq('id', reminderId);

      if (error) throw error;

      setSelectedReminder(null);
      setOutcomeNotes('');
      showToast({ type: 'success', message: 'Reminder marked as complete.' });
      await fetchData();
    } catch (error) {
      console.error('Error completing reminder:', error);
      showToast({ type: 'error', message: 'Failed to complete reminder.' });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSnoozeReminder = async (reminderId: string) => {
    if (!snoozeDate) {
      showToast({ type: 'error', message: 'Please select a snooze date.' });
      return;
    }

    setIsSnoozing(true);
    try {
      const { error } = await supabase
        .from('job_completion_reminders')
        .update({
          status: 'snoozed',
          snoozed_until: snoozeDate,
        })
        .eq('id', reminderId);

      if (error) throw error;

      setSelectedReminder(null);
      setSnoozeDate('');
      showToast({ type: 'success', message: 'Reminder snoozed.' });
      await fetchData();
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      showToast({ type: 'error', message: 'Failed to snooze reminder.' });
    } finally {
      setIsSnoozing(false);
    }
  };

  const handleDismissReminder = async (reminderId: string) => {
    setIsDismissing(true);
    try {
      const { error } = await supabase
        .from('job_completion_reminders')
        .update({ status: 'dismissed' })
        .eq('id', reminderId);

      if (error) throw error;

      setSelectedReminder(null);
      setDismissReminderId(null);
      showToast({ type: 'success', message: 'Reminder dismissed.' });
      await fetchData();
    } catch (error) {
      console.error('Error dismissing reminder:', error);
      showToast({ type: 'error', message: 'Failed to dismiss reminder.' });
    } finally {
      setIsDismissing(false);
    }
  };

  const getReminderTypeLabel = (type: string) => {
    switch (type) {
      case 'follow_up_call':
        return 'Follow-up Call';
      case 'warranty_check':
        return 'Warranty Check';
      case 'repeat_business':
        return 'Repeat Business';
      case 'custom':
        return 'Custom';
      default:
        return type;
    }
  };

  const todayReminders = filteredReminders.filter(r => r.status === 'pending' && isToday(r));
  const overdueReminders = filteredReminders.filter(r => isOverdue(r));
  const upcomingReminders = filteredReminders.filter(r =>
    r.status === 'pending' && !isOverdue(r) && !isToday(r)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Follow-up Reminders</h1>
        <p className="text-sm sm:text-base text-slate-600">Manage customer follow-up reminders and warranty checks</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input name="searchTerm"
              type="text"
              placeholder="Search by customer name or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg font-medium transition-colors flex items-center gap-2 ${
              showFilters ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Reminders</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="snoozed">Snoozed</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl p-3 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Total</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{reminders.length}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Due Today</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{todayReminders.length}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Overdue</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{overdueReminders.length}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Completed</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            {reminders.filter(r => r.status === 'completed').length}
          </p>
        </div>
      </div>

      {overdueReminders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Overdue Reminders
          </h2>
          <div className="space-y-3">
            {overdueReminders.map(reminder => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                isOverdue={true}
                onSelect={() => setSelectedReminder(reminder)}
              />
            ))}
          </div>
        </div>
      )}

      {todayReminders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            Due Today
          </h2>
          <div className="space-y-3">
            {todayReminders.map(reminder => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                isToday={true}
                onSelect={() => setSelectedReminder(reminder)}
              />
            ))}
          </div>
        </div>
      )}

      {upcomingReminders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Upcoming Reminders
          </h2>
          <div className="space-y-3">
            {upcomingReminders.map(reminder => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onSelect={() => setSelectedReminder(reminder)}
              />
            ))}
          </div>
        </div>
      )}

      {filteredReminders.filter(r => r.status === 'completed').length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-purple-600" />
            Completed Reminders
          </h2>
          <div className="space-y-3">
            {filteredReminders
              .filter(r => r.status === 'completed')
              .map(reminder => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  isCompleted={true}
                  onSelect={() => setSelectedReminder(reminder)}
                />
              ))}
          </div>
        </div>
      )}

      {filteredReminders.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">
            {reminders.length === 0 ? 'No reminders yet' : 'No reminders match your filters'}
          </p>
        </div>
      )}


      <ConfirmActionModal
        isOpen={!!dismissReminderId}
        title="Dismiss reminder"
        description="Are you sure you want to dismiss this reminder?"
        confirmLabel="Dismiss"
        isLoading={isDismissing}
        onCancel={() => setDismissReminderId(null)}
        onConfirm={() => dismissReminderId && handleDismissReminder(dismissReminderId)}
      />

      {selectedReminder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedReminder.job?.client_name}</h2>
                <p className="text-sm text-slate-600 mt-1">{getReminderTypeLabel(selectedReminder.reminder_type)}</p>
              </div>
              <button
                onClick={() => setSelectedReminder(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Scheduled Date</p>
                    <p className="font-semibold text-slate-900">{formatDate(selectedReminder.scheduled_date)}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Status</p>
                    <p className="font-semibold text-slate-900 capitalize">{selectedReminder.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Job Type</p>
                    <p className="font-semibold text-slate-900">{selectedReminder.job?.job_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Phone</p>
                    <p className="font-semibold text-slate-900">{selectedReminder.job?.client_phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {selectedReminder.admin_notes && (
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Notes</label>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg">
                    {selectedReminder.admin_notes}
                  </p>
                </div>
              )}

              {selectedReminder.status === 'pending' && (
                <>
                  <div>
                    <label htmlFor="outcome-notes" className="block text-sm font-semibold text-slate-900 mb-2">
                      Outcome Notes (Optional)
                    </label>
                    <textarea
                      id="outcome-notes"
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      rows={4}
                      placeholder="What was the outcome of this follow-up?..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="snooze-date" className="block text-sm font-semibold text-slate-900 mb-2">
                      Snooze Until
                    </label>
                    <input
                      id="snooze-date"
                      type="date"
                      value={snoozeDate}
                      onChange={(e) => setSnoozeDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </>
              )}

              {selectedReminder.status === 'completed' && selectedReminder.outcome_notes && (
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Outcome Notes</label>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg">
                    {selectedReminder.outcome_notes}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              {selectedReminder.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleCompleteReminder(selectedReminder.id)}
                    disabled={isCompleting || isSnoozing || isDismissing}
                    className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {isCompleting ? 'Saving...' : 'Mark Complete'}
                  </button>
                  <button
                    onClick={() => handleSnoozeReminder(selectedReminder.id)}
                    disabled={!snoozeDate || isCompleting || isSnoozing || isDismissing}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Clock className="w-5 h-5" />
                    {isSnoozing ? 'Saving...' : 'Snooze'}
                  </button>
                  <button
                    onClick={() => setDismissReminderId(selectedReminder.id)}
                    disabled={isCompleting || isSnoozing || isDismissing}
                    className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </>
              )}
              {selectedReminder.status !== 'pending' && (
                <button
                  onClick={() => setSelectedReminder(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderCard({
  reminder,
  isOverdue = false,
  isToday = false,
  isCompleted = false,
  onSelect,
}: {
  reminder: ReminderWithDetails;
  isOverdue?: boolean;
  isToday?: boolean;
  isCompleted?: boolean;
  onSelect: () => void;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getReminderTypeLabel = (type: string) => {
    switch (type) {
      case 'follow_up_call':
        return 'Follow-up Call';
      case 'warranty_check':
        return 'Warranty Check';
      case 'repeat_business':
        return 'Repeat Business';
      case 'custom':
        return 'Custom';
      default:
        return type;
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow cursor-pointer ${
        isOverdue
          ? 'border-red-200 bg-red-50'
          : isToday
          ? 'border-emerald-200 bg-emerald-50'
          : isCompleted
          ? 'border-slate-200 bg-slate-50'
          : 'border-slate-200'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">{reminder.job?.client_name}</h3>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
              isOverdue
                ? 'bg-red-100 text-red-800 border border-red-200'
                : isToday
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : isCompleted
                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}>
              {getReminderTypeLabel(reminder.reminder_type)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(reminder.scheduled_date)}
            </div>
            {reminder.job?.client_phone && <span>{reminder.job.client_phone}</span>}
          </div>
          {reminder.admin_notes && (
            <p className="text-sm text-slate-600 mt-2 line-clamp-2">{reminder.admin_notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
