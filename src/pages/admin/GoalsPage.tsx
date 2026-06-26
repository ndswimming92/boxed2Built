import { useState, useEffect } from 'react';
import { Target, Plus, Search, CreditCard as Edit, Trash2, Check, Archive, TrendingUp, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Goal } from '../../lib/supabase';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  completeGoal,
  archiveGoal,
  updateGoalProgress,
} from '../../services/goalsService';
import GoalFormModal from '../../components/admin/GoalFormModal';

export default function GoalsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [filteredGoals, setFilteredGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingProgressId, setUpdatingProgressId] = useState<string | null>(null);
  const [progressInputValue, setProgressInputValue] = useState<number>(0);

  useEffect(() => {
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (businessId) {
      loadGoals();
    }
  }, [businessId]);

  useEffect(() => {
    applyFilters();
  }, [goals, searchQuery, filterStatus, filterPriority, filterCategory]);

  const fetchBusinessId = async () => {
    const { data } = await supabase
      .from('business_info')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      setBusinessId(data.id);
    }
  };

  const loadGoals = async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const data = await getGoals(businessId);
      setGoals(data);
    } catch (error) {
      console.error('Error loading goals:', error);
      showMessage('error', 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...goals];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (goal) =>
          goal.title.toLowerCase().includes(query) ||
          goal.description.toLowerCase().includes(query)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((goal) => goal.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter((goal) => goal.priority === filterPriority);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter((goal) => goal.category === filterCategory);
    }

    setFilteredGoals(filtered);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateGoal = () => {
    setEditingGoal(null);
    setShowModal(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setShowModal(true);
  };

  const handleSaveGoal = async (goalData: Partial<Goal>) => {
    if (!businessId) return;

    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, goalData);
        showMessage('success', 'Goal updated successfully');
      } else {
        await createGoal(businessId, goalData);
        showMessage('success', 'Goal created successfully');
      }
      await loadGoals();
    } catch (error) {
      showMessage('error', 'Failed to save goal');
      throw error;
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      await deleteGoal(id);
      showMessage('success', 'Goal deleted successfully');
      await loadGoals();
    } catch (error) {
      showMessage('error', 'Failed to delete goal');
    }
  };

  const handleCompleteGoal = async (id: string) => {
    try {
      await completeGoal(id);
      showMessage('success', 'Goal marked as completed');
      await loadGoals();
    } catch (error) {
      showMessage('error', 'Failed to complete goal');
    }
  };

  const handleArchiveGoal = async (id: string) => {
    try {
      await archiveGoal(id);
      showMessage('success', 'Goal archived successfully');
      await loadGoals();
    } catch (error) {
      showMessage('error', 'Failed to archive goal');
    }
  };

  const handleUpdateProgress = async (id: string, currentValue: number) => {
    try {
      await updateGoalProgress(id, currentValue);
      setUpdatingProgressId(null);
      await loadGoals();
    } catch (error) {
      showMessage('error', 'Failed to update progress');
    }
  };

  const openProgressPanel = (goal: Goal) => {
    setProgressInputValue(goal.current_value);
    setUpdatingProgressId(goal.id);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_started':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatUnitValue = (value: number, unitType: string, unitLabel: string | null) => {
    switch (unitType) {
      case 'revenue':
        return `$${value.toLocaleString()}`;
      case 'jobs':
        return `${value} jobs`;
      case 'hours':
        return `${value} hours`;
      case 'percentage':
        return `${value}%`;
      case 'custom':
        return `${value} ${unitLabel || ''}`;
      default:
        return value.toString();
    }
  };

  const getDaysRemaining = (dueDate: string | null) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="flex items-center gap-3">
            <Target className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Business Goals</h1>
          </div>
          <button
            onClick={handleCreateGoal}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 self-start sm:self-auto flex-shrink-0"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            New Goal
          </button>
        </div>
        <p className="text-sm sm:text-base text-slate-600">Track and manage your business objectives</p>
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
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              id="goal-search"
              name="goalSearch"
              placeholder="Search goals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <select
            id="goal-status-filter"
            name="goalStatusFilter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            id="goal-priority-filter"
            name="goalPriorityFilter"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            id="goal-category-filter"
            name="goalCategoryFilter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            <option value="financial">Financial</option>
            <option value="operational">Operational</option>
            <option value="growth">Growth</option>
            <option value="customer_satisfaction">Customer Satisfaction</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {filteredGoals.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No goals found</h3>
          <p className="text-slate-600 mb-6">
            {goals.length === 0
              ? 'Start by creating your first business goal'
              : 'Try adjusting your filters'}
          </p>
          {goals.length === 0 && (
            <button
              onClick={handleCreateGoal}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Your First Goal
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredGoals.map((goal) => {
            const daysRemaining = getDaysRemaining(goal.due_date);
            const isOverdue = daysRemaining !== null && daysRemaining < 0;
            const isDueSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

            return (
              <div
                key={goal.id}
                className={`bg-white rounded-xl border p-6 transition-all hover:shadow-md ${
                  isOverdue ? 'border-red-300' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{goal.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(
                          goal.priority
                        )}`}
                      >
                        {goal.priority.toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                          goal.status
                        )}`}
                      >
                        {getStatusLabel(goal.status)}
                      </span>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-slate-600 mb-3">{goal.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                      <span className="capitalize">{goal.category.replace('_', ' ')}</span>
                      {goal.due_date && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className={goal.status !== 'completed' && (isDueSoon || isOverdue) ? 'text-red-600 font-medium' : ''}>
                            Due {new Date(goal.due_date).toLocaleDateString()}
                            {daysRemaining !== null && goal.status !== 'completed' && (
                              <span className="ml-1">
                                ({isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days left`})
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {goal.status !== 'completed' && goal.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCompleteGoal(goal.id)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Mark as Complete"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditGoal(goal)}
                      className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      title="Edit Goal"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    {goal.status === 'completed' && (
                      <button
                        onClick={() => handleArchiveGoal(goal.id)}
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Archive Goal"
                      >
                        <Archive className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm">
                    <span className="text-slate-600">Progress</span>
                    <span className="font-semibold text-slate-900 text-xs sm:text-sm break-words">
                      {formatUnitValue(goal.current_value, goal.unit_type, goal.unit_label)} /{' '}
                      {formatUnitValue(goal.target_value, goal.unit_type, goal.unit_label)}
                    </span>
                  </div>
                  <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                        goal.progress_percentage >= 100
                          ? 'bg-emerald-500'
                          : goal.progress_percentage >= 75
                          ? 'bg-blue-500'
                          : goal.progress_percentage >= 50
                          ? 'bg-yellow-500'
                          : 'bg-orange-500'
                      }`}
                      style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{Math.round(goal.progress_percentage)}% Complete</span>
                    {goal.status !== 'completed' && goal.status !== 'cancelled' && updatingProgressId !== goal.id && (
                      <button
                        onClick={() => openProgressPanel(goal)}
                        className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Update Progress
                      </button>
                    )}
                  </div>

                  {updatingProgressId === goal.id && (
                    <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Update Current Progress</span>
                        <button
                          onClick={() => setUpdatingProgressId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="relative">
                        {goal.unit_type === 'revenue' && (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">$</span>
                        )}
                        <input
                          type="number"
                          value={progressInputValue}
                          onChange={(e) => setProgressInputValue(parseFloat(e.target.value) || 0)}
                          className={`w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm ${
                            goal.unit_type === 'revenue' ? 'pl-7 pr-4' : 'px-4'
                          }`}
                          min="0"
                          step={goal.unit_type === 'revenue' ? '1' : '0.01'}
                          placeholder={goal.unit_type === 'revenue' ? 'Enter amount achieved...' : 'Enter current value...'}
                        />
                      </div>
                      {goal.unit_type === 'revenue' && (
                        <div>
                          <input
                            type="range"
                            min="0"
                            max={goal.target_value}
                            step="100"
                            value={Math.min(progressInputValue, goal.target_value)}
                            onChange={(e) => setProgressInputValue(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>$0</span>
                            <span className="font-medium text-emerald-700">
                              {progressInputValue > 0 ? `$${progressInputValue.toLocaleString()} (${Math.round((progressInputValue / goal.target_value) * 100)}%)` : '$0'}
                            </span>
                            <span>${goal.target_value.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleUpdateProgress(goal.id, progressInputValue)}
                          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                          Save Progress
                        </button>
                        <button
                          onClick={() => setUpdatingProgressId(null)}
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <GoalFormModal goal={editingGoal} onClose={() => setShowModal(false)} onSave={handleSaveGoal} />
      )}
    </div>
  );
}
