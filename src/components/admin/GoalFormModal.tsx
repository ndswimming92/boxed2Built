import React, { useState, useEffect } from 'react';
import { X, Save, Target } from 'lucide-react';
import type { Goal } from '../../lib/supabase';

interface GoalFormModalProps {
  goal?: Goal | null;
  onClose: () => void;
  onSave: (goalData: Partial<Goal>) => Promise<void>;
}

const CATEGORY_OPTIONS = [
  { value: 'financial', label: 'Financial' },
  { value: 'operational', label: 'Operational' },
  { value: 'growth', label: 'Growth' },
  { value: 'customer_satisfaction', label: 'Customer Satisfaction' },
  { value: 'custom', label: 'Custom' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'overdue', label: 'Overdue' },
];

const UNIT_TYPE_OPTIONS = [
  { value: 'revenue', label: 'Revenue ($)' },
  { value: 'jobs', label: 'Jobs (count)' },
  { value: 'hours', label: 'Hours' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'custom', label: 'Custom' },
];

export default function GoalFormModal({ goal, onClose, onSave }: GoalFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Goal['category']>('custom');
  const [priority, setPriority] = useState<Goal['priority']>('medium');
  const [status, setStatus] = useState<Goal['status']>('not_started');
  const [targetValue, setTargetValue] = useState<number>(0);
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [unitType, setUnitType] = useState<Goal['unit_type']>('custom');
  const [unitLabel, setUnitLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (goal) {
      setTitle(goal.title || '');
      setDescription(goal.description || '');
      setCategory(goal.category || 'custom');
      setPriority(goal.priority || 'medium');
      setStatus(goal.status || 'not_started');
      setTargetValue(goal.target_value || 0);
      setCurrentValue(goal.current_value || 0);
      setUnitType(goal.unit_type || 'custom');
      setUnitLabel(goal.unit_label || '');
      setStartDate(goal.start_date || '');
      setDueDate(goal.due_date || '');
    }
  }, [goal]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (targetValue <= 0) {
      newErrors.targetValue = 'Target value must be greater than 0';
    }

    if (currentValue < 0) {
      newErrors.currentValue = 'Current value cannot be negative';
    }

    if (unitType === 'custom' && !unitLabel.trim()) {
      newErrors.unitLabel = 'Unit label is required for custom unit type';
    }

    if (dueDate && startDate && new Date(dueDate) < new Date(startDate)) {
      newErrors.dueDate = 'Due date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      await onSave({
        title,
        description,
        category,
        priority,
        status,
        target_value: targetValue,
        current_value: currentValue,
        unit_type: unitType,
        unit_label: unitType === 'custom' ? unitLabel : null,
        start_date: startDate || null,
        due_date: dueDate || null,
      });
      onClose();
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">
              {goal ? 'Edit Goal' : 'Create New Goal'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Goal Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.title ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="e.g., Reach $50,000 in monthly revenue"
            />
            {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Describe your goal and how you plan to achieve it..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Goal['category'])}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Goal['priority'])}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Goal['status'])}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Target Value *
              </label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.targetValue ? 'border-red-500' : 'border-slate-300'
                }`}
                min="0"
                step="0.01"
              />
              {errors.targetValue && (
                <p className="text-sm text-red-600 mt-1">{errors.targetValue}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current Value
              </label>
              <input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.currentValue ? 'border-red-500' : 'border-slate-300'
                }`}
                min="0"
                step="0.01"
              />
              {errors.currentValue && (
                <p className="text-sm text-red-600 mt-1">{errors.currentValue}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Unit Type
              </label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as Goal['unit_type'])}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {UNIT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {unitType === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Custom Unit Label *
                </label>
                <input
                  type="text"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.unitLabel ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="e.g., customers, reviews, etc."
                />
                {errors.unitLabel && (
                  <p className="text-sm text-red-600 mt-1">{errors.unitLabel}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.dueDate ? 'border-red-500' : 'border-slate-300'
                }`}
              />
              {errors.dueDate && <p className="text-sm text-red-600 mt-1">{errors.dueDate}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {goal ? 'Update Goal' : 'Create Goal'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
