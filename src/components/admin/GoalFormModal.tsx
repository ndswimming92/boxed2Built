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
  const [targetValue, setTargetValue] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
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
      setTargetValue(goal.target_value ? String(goal.target_value) : '');
      setCurrentValue(goal.current_value ? String(goal.current_value) : '');
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

    if (parseFloat(targetValue) <= 0 || !targetValue) {
      newErrors.targetValue = 'Target value must be greater than 0';
    }

    if (parseFloat(currentValue) < 0) {
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
        target_value: parseFloat(targetValue) || 0,
        current_value: parseFloat(currentValue) || 0,
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
    <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-2xl w-full max-h-dvh sm:max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Goal Title *
            </label>
            <input name="title"
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
            <textarea name="description"
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
              <select name="category"
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
              <select name="priority"
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
              <select name="status"
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
              <div className="relative">
                {unitType === 'revenue' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                )}
                <input name="targetValue"
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className={`w-full py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    unitType === 'revenue' ? 'pl-7 pr-4' : 'px-4'
                  } ${errors.targetValue ? 'border-red-500' : 'border-slate-300'}`}
                  min="0"
                  step={unitType === 'revenue' ? '1' : '0.01'}
                />
              </div>
              {unitType === 'revenue' && parseFloat(targetValue) > 0 && (
                <div className="mt-2">
                  <input
                    type="range"
                    min="0"
                    max={Math.max(parseFloat(targetValue) * 2, 100000)}
                    step="100"
                    value={parseFloat(targetValue)}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>$0</span>
                    <span>${(Math.max(parseFloat(targetValue) * 2, 100000)).toLocaleString()}</span>
                  </div>
                </div>
              )}
              {errors.targetValue && (
                <p className="text-sm text-red-600 mt-1">{errors.targetValue}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current Value
              </label>
              <div className="relative">
                {unitType === 'revenue' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                )}
                <input name="currentValue"
                  type="number"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className={`w-full py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    unitType === 'revenue' ? 'pl-7 pr-4' : 'px-4'
                  } ${errors.currentValue ? 'border-red-500' : 'border-slate-300'}`}
                  min="0"
                  step={unitType === 'revenue' ? '1' : '0.01'}
                />
              </div>
              {unitType === 'revenue' && parseFloat(targetValue) > 0 && (
                <div className="mt-2">
                  <input
                    type="range"
                    min="0"
                    max={parseFloat(targetValue)}
                    step="100"
                    value={Math.min(parseFloat(currentValue) || 0, parseFloat(targetValue))}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>$0</span>
                    <span>${parseFloat(targetValue).toLocaleString()}</span>
                  </div>
                </div>
              )}
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
              <select name="unitType"
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
                <input name="unitLabel"
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
              <input name="startDate"
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
              <input name="dueDate"
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

          </div>
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-200" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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
