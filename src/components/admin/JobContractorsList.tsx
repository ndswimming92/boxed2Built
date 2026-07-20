import { useState, useEffect } from 'react';
import { HardHat, ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from 'lucide-react';
import { JobContractorWithContractor } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../utils/jobCalculations';
import { getJobContractors, removeJobContractor } from '../../services/contractorService';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import JobContractorModal from './JobContractorModal';

interface JobContractorsListProps {
  jobId: string;
  businessId: string;
  organizationId?: string | null;
  jobRevenue?: number | null;
  onChange?: () => void;
}

export default function JobContractorsList({
  jobId,
  businessId,
  organizationId,
  jobRevenue,
  onChange,
}: JobContractorsListProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const [assignments, setAssignments] = useState<JobContractorWithContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<JobContractorWithContractor | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, [jobId]);

  const fetchAssignments = async () => {
    setLoading(true);
    const data = await getJobContractors(jobId);
    setAssignments(data);
    setLoading(false);
    if (data.length > 0) setExpanded(true);
  };

  const handleRemove = async (assignment: JobContractorWithContractor) => {
    const name = assignment.contractor?.name || 'this contractor';
    if (!confirm(`Remove ${name} from this job? This deletes the payment record.`)) return;
    const ok = await removeJobContractor(assignment.id);
    if (ok) {
      await fetchAssignments();
      onChange?.();
    }
  };

  const handleSaved = async () => {
    await fetchAssignments();
    onChange?.();
  };

  const total = assignments.reduce((sum, a) => sum + (Number(a.amount_paid) || 0), 0);

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left hover:bg-slate-50 p-2 rounded-lg transition-colors"
        >
          <HardHat className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-slate-700">
            Contractors ({assignments.length})
          </span>
          {total > 0 && (
            <span className="text-sm font-semibold text-rose-600">
              {maskFinancialValue(formatCurrency(total))} paid
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contractor
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-slate-500 px-2 py-3">
              No contractors on this job yet.
            </p>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {a.contractor?.name || 'Unknown contractor'}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-bold rounded border bg-rose-50 text-rose-700 border-rose-200">
                        {maskFinancialValue(formatCurrency(Number(a.amount_paid) || 0))}
                      </span>
                    </div>
                    {a.work_description && (
                      <p className="text-xs text-slate-600">{a.work_description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      {a.payment_date && <span>Paid {formatDate(a.payment_date)}</span>}
                      {a.payment_method && <span>{a.payment_method}</span>}
                    </div>
                    {a.notes && <p className="text-xs text-slate-500 mt-1 italic">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditing(a);
                        setShowModal(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                      title="Edit payment"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(a)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove from job"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <JobContractorModal
          jobId={jobId}
          businessId={businessId}
          organizationId={organizationId}
          jobRevenue={jobRevenue}
          assignment={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
