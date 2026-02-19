import React, { useEffect, useState } from 'react';
import { FlaskConical, Plus, Trash2, CheckCircle, AlertCircle, User, Mail } from 'lucide-react';
import {
  TestIdentifier,
  getTestIdentifiers,
  addTestIdentifier,
  deleteTestIdentifier,
} from '../../services/testIdentifierService';

export default function TestIdentifiersPage() {
  const [identifiers, setIdentifiers] = useState<TestIdentifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newType, setNewType] = useState<'name' | 'email'>('name');
  const [newValue, setNewValue] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchIdentifiers();
  }, []);

  const fetchIdentifiers = async () => {
    setLoading(true);
    const data = await getTestIdentifiers();
    setIdentifiers(data);
    setLoading(false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    setIsAdding(true);
    try {
      await addTestIdentifier(newType, newValue.trim(), newNotes.trim() || undefined);
      await fetchIdentifiers();
      setNewValue('');
      setNewNotes('');
      setShowAddForm(false);
      showMessage('success', `Test ${newType} added successfully.`);
    } catch {
      showMessage('error', 'Failed to add test identifier.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string, value: string) => {
    if (!confirm(`Remove "${value}" from test identifiers?`)) return;
    try {
      await deleteTestIdentifier(id);
      await fetchIdentifiers();
      showMessage('success', `"${value}" removed from test identifiers.`);
    } catch {
      showMessage('error', 'Failed to remove test identifier.');
    }
  };

  const nameIdentifiers = identifiers.filter((i) => i.type === 'name');
  const emailIdentifiers = identifiers.filter((i) => i.type === 'email');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FlaskConical className="w-6 h-6 text-amber-700" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Test Identifiers</h1>
        </div>
        <p className="text-slate-600 mt-1">
          Submissions matching these names or emails are automatically flagged as tests and excluded
          from your metrics, stats, and inquiry counts. Formspree email notifications still fire for
          test submissions.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <FlaskConical className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">How it works</p>
          <p>
            When a form is submitted, the name and email are checked against this list (case-insensitive).
            If either matches, the submission is stored with an <code className="bg-amber-100 px-1 rounded">is_test = true</code> flag.
            Test submissions are hidden from all metrics by default but can be viewed in the Inquiries
            page using the "Show Tests" toggle.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Test Names</h2>
            <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {nameIdentifiers.length}
            </span>
          </div>
          {nameIdentifiers.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500 text-sm">No test names configured</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {nameIdentifiers.map((identifier) => (
                <li key={identifier.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{identifier.value}</p>
                    {identifier.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{identifier.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(identifier.id, identifier.value)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Test Emails</h2>
            <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {emailIdentifiers.length}
            </span>
          </div>
          {emailIdentifiers.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500 text-sm">No test emails configured</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {emailIdentifiers.map((identifier) => (
                <li key={identifier.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{identifier.value}</p>
                    {identifier.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{identifier.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(identifier.id, identifier.value)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Test Identifier
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Add New Test Identifier</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="name"
                      checked={newType === 'name'}
                      onChange={() => setNewType('name')}
                      className="text-emerald-600"
                    />
                    <span className="text-sm text-slate-700 flex items-center gap-1">
                      <User className="w-4 h-4" /> Name
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="email"
                      checked={newType === 'email'}
                      onChange={() => setNewType('email')}
                      className="text-emerald-600"
                    />
                    <span className="text-sm text-slate-700 flex items-center gap-1">
                      <Mail className="w-4 h-4" /> Email
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {newType === 'name' ? 'Full Name' : 'Email Address'}
                </label>
                <input
                  type={newType === 'email' ? 'email' : 'text'}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={newType === 'name' ? 'e.g. Jane Smith' : 'e.g. test@example.com'}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Internal QA testing"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isAdding || !newValue.trim()}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAdding ? 'Adding...' : 'Add Identifier'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewValue('');
                    setNewNotes('');
                  }}
                  className="px-5 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
