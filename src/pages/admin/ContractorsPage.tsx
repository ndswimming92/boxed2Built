import { useEffect, useState } from 'react';
import { HardHat, Plus, Search, Mail, Phone, DollarSign, Briefcase, Pencil, Trash2, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { supabase, Contractor } from '../../lib/supabase';
import {
  getContractorsWithTotals,
  deleteContractor,
  type ContractorWithTotals,
} from '../../services/contractorService';
import ContractorFormModal from '../../components/admin/ContractorFormModal';
import { formatCurrency } from '../../utils/jobCalculations';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../services/auditLogService';

export default function ContractorsPage() {
  const { maskFinancialValue } = usePrivacyMode();
  const { currentOrganization } = useAuth();
  const [contractors, setContractors] = useState<ContractorWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: bizData } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (bizData) {
        setBusinessId(bizData.id);
        const data = await getContractorsWithTotals(bizData.id);
        setContractors(data);
      }
    } catch (error) {
      console.error('Error fetching contractors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contractor: Contractor) => {
    if (!confirm(`Remove ${contractor.name}? Their past job payment records are kept for reporting.`)) return;
    const ok = await deleteContractor(contractor.id);
    if (ok) {
      await logAction({
        actionType: 'DELETE',
        tableName: 'contractors',
        recordId: contractor.id,
        recordIdentifier: contractor.name,
      });
      setMessage({ type: 'success', text: 'Contractor removed.' });
      fetchData();
    } else {
      setMessage({ type: 'error', text: 'Failed to remove contractor.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const filtered = contractors.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    );
  });

  const totalPaidAllTime = contractors.reduce((sum, c) => sum + c.total_paid, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Contractors</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Manage the people who help on jobs and track what you've paid them.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Contractor
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Contractors</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{contractors.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-rose-100 rounded-lg">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Total Paid</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{maskFinancialValue(formatCurrency(totalPaidAllTime))}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search contractors by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <HardHat className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">
            {contractors.length === 0 ? 'No contractors yet' : 'No contractors match your search'}
          </p>
          {contractors.length === 0 && (
            <button
              onClick={() => {
                setEditing(null);
                setShowModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Add Your First Contractor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contractor) => (
            <div key={contractor.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                    <HardHat className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 truncate">{contractor.name}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditing(contractor);
                      setShowModal(true);
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                    title="Edit contractor"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contractor)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove contractor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {contractor.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{contractor.phone}</span>
                  </div>
                )}
                {contractor.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{contractor.email}</span>
                  </div>
                )}
                {contractor.notes && (
                  <p className="text-sm text-slate-500 italic pt-1">{contractor.notes}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Total Paid
                  </p>
                  <p className="text-base font-bold text-rose-600">{maskFinancialValue(formatCurrency(contractor.total_paid))}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    Jobs
                  </p>
                  <p className="text-base font-bold text-slate-900">{contractor.job_count}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && businessId && (
        <ContractorFormModal
          contractor={editing}
          businessId={businessId}
          organizationId={currentOrganization?.id ?? null}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSave={async (saved) => {
            await logAction({
              actionType: editing ? 'UPDATE' : 'CREATE',
              tableName: 'contractors',
              recordId: saved.id,
              recordIdentifier: saved.name,
            });
            setMessage({ type: 'success', text: editing ? 'Contractor updated.' : 'Contractor added.' });
            fetchData();
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
}
