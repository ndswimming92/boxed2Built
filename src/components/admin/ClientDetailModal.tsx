import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mail, Phone, MapPin, DollarSign, Briefcase, Tag, FileText, AlertCircle, Pencil, Check, Gift, Copy, Users, Plus, Minus, Upload, FolderOpen, Eye, Lock, Trash2, Download, ExternalLink, Send, Receipt, ChevronDown } from 'lucide-react';
import Modal from '../Modal';
import {
  type Client,
  type ClientHistory,
  type ClientNote,
  getClientHistory,
  getClientNotes,
  createClientNote,
  updateMarketingPreferences,
  addClientTags,
  removeClientTags,
  updateClient,
  getReferredClients,
  addReferralCredit,
  redeemReferralCredit,
  deleteClient,
} from '../../services/clientService';
import {
  type AdminDocument,
  type CustomerOption,
  getCustomerIdForClient,
  getDocumentsForCustomer,
  getCustomersForOrg,
  softDeleteDocument,
  getAdminDocumentSignedUrl,
} from '../../services/adminDocumentService';
import AdminDocumentUploadModal from './AdminDocumentUploadModal';
import InvoiceFormModal from './InvoiceFormModal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getDirectionsUrl as getAddressDirectionsUrl, hasSeparateWorkAddress, resolveWorkAddress } from '../../utils/jobAddress';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
  onDeleted?: (clientId: string) => void;
}

type ActiveTab = 'overview' | 'documents';

export default function ClientDetailModal({ client, onClose, onDeleted }: ClientDetailModalProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const { currentOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [history, setHistory] = useState<ClientHistory | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(client.marketing_email_opt_in);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerIdLoading, setCustomerIdLoading] = useState(false);
  const [customerIdResolved, setCustomerIdResolved] = useState(false);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState(client.name);
  const [editEmail, setEditEmail] = useState(client.email ?? '');
  const [editPhone, setEditPhone] = useState(client.phone ?? '');
  const [editAddress, setEditAddress] = useState(client.address ?? '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [saveInfoError, setSaveInfoError] = useState<string | null>(null);
  const [currentClient, setCurrentClient] = useState<Client>(client);
  const [referredClients, setReferredClients] = useState<Client[]>([]);
  const [codeCopied, setCodeCopied] = useState(false);
  const [creditAmount, setCreditAmount] = useState('25');
  const [creditAction, setCreditAction] = useState<'add' | 'redeem' | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditMessage, setCreditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dangerZoneRef = useRef<HTMLDivElement>(null);

  function revealDeleteConfirm() {
    setActiveTab('overview');
    setShowDeleteConfirm(true);
    setDeleteError(null);
    setTimeout(() => {
      dangerZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  const COOLDOWN_MS = 10 * 60 * 1000;
  const [followupSending, setFollowupSending] = useState(false);
  const [followupMessage, setFollowupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [followupCooldownRemaining, setFollowupCooldownRemaining] = useState<number>(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invoice email state
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceForEdit, setInvoiceForEdit] = useState<any | null>(null);
  const [invoiceReviewed, setInvoiceReviewed] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceEmailOverride, setInvoiceEmailOverride] = useState('');
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [invoiceCooldownRemaining, setInvoiceCooldownRemaining] = useState<number>(0);
  const invoiceCooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Quote email state
  const [selectedQuoteJobId, setSelectedQuoteJobId] = useState<string>('');
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [quoteCooldownRemaining, setQuoteCooldownRemaining] = useState<number>(0);
  const quoteCooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getEmailHref = useCallback((email: string) => {
    return `mailto:${encodeURIComponent(email.trim())}`;
  }, []);

  const getPhoneHref = useCallback((phone: string) => {
    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    return `tel:${normalizedPhone}`;
  }, []);

  const startCooldownTimer = useCallback((sentAt: string | null) => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    if (!sentAt) { setFollowupCooldownRemaining(0); return; }
    const elapsed = Date.now() - new Date(sentAt).getTime();
    const remaining = Math.max(0, COOLDOWN_MS - elapsed);
    setFollowupCooldownRemaining(Math.ceil(remaining / 1000));
    if (remaining <= 0) return;
    cooldownTimerRef.current = setInterval(() => {
      setFollowupCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCooldownTimer(currentClient.last_followup_email_sent_at);
    return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); };
  }, [currentClient.last_followup_email_sent_at, startCooldownTimer]);

  const startInvoiceCooldownTimer = useCallback((sentAt: string | null) => {
    if (invoiceCooldownTimerRef.current) clearInterval(invoiceCooldownTimerRef.current);
    if (!sentAt) { setInvoiceCooldownRemaining(0); return; }
    const elapsed = Date.now() - new Date(sentAt).getTime();
    const remaining = Math.max(0, COOLDOWN_MS - elapsed);
    setInvoiceCooldownRemaining(Math.ceil(remaining / 1000));
    if (remaining <= 0) return;
    invoiceCooldownTimerRef.current = setInterval(() => {
      setInvoiceCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (invoiceCooldownTimerRef.current) clearInterval(invoiceCooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [COOLDOWN_MS]);

  useEffect(() => {
    startInvoiceCooldownTimer(currentClient.last_invoice_email_sent_at ?? null);
    return () => { if (invoiceCooldownTimerRef.current) clearInterval(invoiceCooldownTimerRef.current); };
  }, [currentClient.last_invoice_email_sent_at, startInvoiceCooldownTimer]);

  const startQuoteCooldownTimer = useCallback((sentAt: string | null) => {
    if (quoteCooldownTimerRef.current) clearInterval(quoteCooldownTimerRef.current);
    if (!sentAt) { setQuoteCooldownRemaining(0); return; }
    const elapsed = Date.now() - new Date(sentAt).getTime();
    const remaining = Math.max(0, COOLDOWN_MS - elapsed);
    setQuoteCooldownRemaining(Math.ceil(remaining / 1000));
    if (remaining <= 0) return;
    quoteCooldownTimerRef.current = setInterval(() => {
      setQuoteCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (quoteCooldownTimerRef.current) clearInterval(quoteCooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [COOLDOWN_MS]);

  useEffect(() => {
    startQuoteCooldownTimer(currentClient.last_quote_email_sent_at ?? null);
    return () => { if (quoteCooldownTimerRef.current) clearInterval(quoteCooldownTimerRef.current); };
  }, [currentClient.last_quote_email_sent_at, startQuoteCooldownTimer]);

  useEffect(() => {
    loadClientDetails();
  }, [client.id]);

  useEffect(() => {
    if (activeTab === 'documents' && !customerIdResolved && currentOrganization) {
      resolveCustomerId();
    }
  }, [activeTab, currentOrganization]);

  const resolveCustomerId = useCallback(async () => {
    if (!currentOrganization) return;
    setCustomerIdLoading(true);
    try {
      const [cid, allCustomers] = await Promise.all([
        getCustomerIdForClient(currentOrganization.id, currentClient.email, currentClient.phone),
        getCustomersForOrg(currentOrganization.id),
      ]);
      setCustomerId(cid);
      setCustomers(allCustomers);
      setCustomerIdResolved(true);
      if (cid) {
        await loadDocuments(cid);
      }
    } catch {
      setCustomerIdResolved(true);
    } finally {
      setCustomerIdLoading(false);
    }
  }, [currentOrganization, currentClient.email, currentClient.phone]);

  const loadDocuments = useCallback(async (cid: string) => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const docs = await getDocumentsForCustomer(cid);
      setDocuments(docs);
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  async function handleViewDocument(doc: AdminDocument) {
    setViewingDocId(doc.id);
    try {
      const url = await getAdminDocumentSignedUrl(doc.storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silently fail — signed URL error
    } finally {
      setViewingDocId(null);
    }
  }

  async function handleDownloadDocument(doc: AdminDocument) {
    setViewingDocId(doc.id);
    try {
      const url = await getAdminDocumentSignedUrl(doc.storage_path, true);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.display_name;
      a.click();
    } catch {
      // silently fail
    } finally {
      setViewingDocId(null);
    }
  }

  async function handleDeleteDocument(doc: AdminDocument) {
    setDeletingDocId(doc.id);
    try {
      await softDeleteDocument(doc.id, doc.storage_path);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      // silently fail
    } finally {
      setDeletingDocId(null);
      setConfirmDeleteId(null);
    }
  }

  async function loadClientDetails() {
    try {
      setLoading(true);
      const [historyData, notesData, referredData] = await Promise.all([
        getClientHistory(currentClient.id, currentClient.email),
        getClientNotes(currentClient.id),
        getReferredClients(currentClient.id),
      ]);
      setHistory(historyData);
      setNotes(notesData);
      setReferredClients(referredData);
    } catch (error) {
      console.error('Error loading client details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;

    try {
      setSavingNote(true);
      const userId = 'current-user-id';
      await createClientNote(currentClient.id, currentClient.organization_id, newNote, userId);
      setNewNote('');
      await loadClientDetails();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleUpdatePreferences() {
    try {
      await updateMarketingPreferences(currentClient.id, emailOptIn);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  }

  async function handleSaveInfo() {
    if (!editName.trim()) return;
    try {
      setSavingInfo(true);
      setSaveInfoError(null);
      const updated = await updateClient(currentClient.id, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
      });
      setCurrentClient(updated);
      setEditingInfo(false);
    } catch (error: any) {
      console.error('Error saving client info:', error);
      if (error?.code === '23505' || error?.message?.includes('unique') || error?.message?.includes('duplicate')) {
        setSaveInfoError('This email is already associated with another client. Use the Merge feature on the Clients page to combine duplicate records.');
      } else {
        setSaveInfoError('Failed to save changes. Please try again.');
      }
    } finally {
      setSavingInfo(false);
    }
  }

  function handleCancelEdit() {
    setEditName(currentClient.name);
    setEditEmail(currentClient.email ?? '');
    setEditPhone(currentClient.phone ?? '');
    setEditAddress(currentClient.address ?? '');
    setSaveInfoError(null);
    setEditingInfo(false);
  }

  async function handleSendFollowup() {
    if (!currentClient.email || followupCooldownRemaining > 0 || followupSending) return;
    setFollowupSending(true);
    setFollowupMessage(null);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-followup-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ clientId: currentClient.id, organizationId: currentClient.organization_id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.error === 'cooldown') {
          startCooldownTimer(new Date(Date.now() - (10 * 60 * 1000 - json.remainingSeconds * 1000)).toISOString());
          setFollowupMessage({ type: 'error', text: 'This email was sent very recently. Please wait before sending again.' });
        } else {
          setFollowupMessage({ type: 'error', text: json.error ?? 'Failed to send follow-up email.' });
        }
        return;
      }
      setCurrentClient((prev) => ({ ...prev, last_followup_email_sent_at: json.sentAt }));
      setFollowupMessage({ type: 'success', text: 'Follow-up email sent successfully.' });
    } catch {
      setFollowupMessage({ type: 'error', text: 'Failed to send follow-up email. Please try again.' });
    } finally {
      setFollowupSending(false);
    }
  }

  async function resolveBusinessId(): Promise<string | null> {
    if (businessId) return businessId;
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase
      .from('business_info')
      .select('id')
      .eq('organization_id', currentClient.organization_id)
      .eq('is_active', true)
      .maybeSingle();
    const bid = data?.id ?? null;
    setBusinessId(bid);
    return bid;
  }

  async function handleJobSelected(jobId: string) {
    setSelectedJobId(jobId);
    setSelectedInvoiceId(null);
    setInvoiceForEdit(null);
    setInvoiceReviewed(false);
    setInvoiceMessage(null);
    if (!jobId) return;
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .eq('is_active', true)
      .not('status', 'in', '("cancelled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setSelectedInvoiceId(data.id);
      setInvoiceForEdit(data);
    }
    await resolveBusinessId();
  }

  async function handleSendInvoiceEmail() {
    const emailToUse = currentClient.email || invoiceEmailOverride.trim();
    if (!selectedInvoiceId || !invoiceReviewed || invoiceSending || invoiceCooldownRemaining > 0 || !emailToUse) return;
    setInvoiceSending(true);
    setInvoiceMessage(null);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const payload: Record<string, string> = {
        clientId: currentClient.id,
        organizationId: currentClient.organization_id,
        invoiceId: selectedInvoiceId,
      };
      if (!currentClient.email && invoiceEmailOverride.trim()) {
        payload.overrideEmail = invoiceEmailOverride.trim();
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.error === 'cooldown') {
          startInvoiceCooldownTimer(new Date(Date.now() - (COOLDOWN_MS - json.remainingSeconds * 1000)).toISOString());
          setInvoiceMessage({ type: 'error', text: 'Invoice email was sent recently. Please wait before sending again.' });
        } else {
          setInvoiceMessage({ type: 'error', text: json.error ?? 'Failed to send invoice email.' });
        }
        return;
      }
      setCurrentClient((prev) => ({ ...prev, last_invoice_email_sent_at: json.sentAt }));
      setInvoiceMessage({ type: 'success', text: 'Invoice email sent successfully.' });
      setSelectedJobId('');
      setSelectedInvoiceId(null);
      setInvoiceReviewed(false);
    } catch {
      setInvoiceMessage({ type: 'error', text: 'Failed to send invoice email. Please try again.' });
    } finally {
      setInvoiceSending(false);
    }
  }

  async function handleSendQuoteEmail() {
    if (!selectedQuoteJobId || !currentClient.email || quoteSending || quoteCooldownRemaining > 0) return;
    setQuoteSending(true);
    setQuoteMessage(null);
    try {
      const { sendQuoteEmail } = await import('../../services/quoteEmailService');
      const result = await sendQuoteEmail(currentClient.id, currentClient.organization_id, selectedQuoteJobId);
      if (!result.success) {
        if (result.error === 'cooldown') {
          startQuoteCooldownTimer(new Date(Date.now() - (COOLDOWN_MS - (result.remainingSeconds ?? 0) * 1000)).toISOString());
          setQuoteMessage({ type: 'error', text: 'Quote email was sent recently. Please wait before sending again.' });
        } else {
          setQuoteMessage({ type: 'error', text: result.error ?? 'Failed to send quote email.' });
        }
        return;
      }
      setCurrentClient((prev) => ({ ...prev, last_quote_email_sent_at: result.sentAt ?? null }));
      setQuoteMessage({ type: 'success', text: 'Quote email sent successfully.' });
      setSelectedQuoteJobId('');
    } catch {
      setQuoteMessage({ type: 'error', text: 'Failed to send quote email. Please try again.' });
    } finally {
      setQuoteSending(false);
    }
  }

  async function handlePermanentDelete() {
    if (deleteConfirmText !== currentClient.name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteClient(currentClient.id);
      onDeleted?.(currentClient.id);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete client. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddTag() {
    if (!newTag.trim()) return;

    try {
      await addClientTags(currentClient.id, [newTag.trim()]);
      setNewTag('');
      onClose();
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  }

  async function handleRemoveTag(tag: string) {
    try {
      await removeClientTags(currentClient.id, [tag]);
      onClose();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  }

  function formatCurrency(amount: number): string {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

    return maskFinancialValue(formatted);
  }

  function formatDate(date: string | null): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatDateTime(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function copyReferralCode() {
    if (!currentClient.referral_code) return;
    navigator.clipboard.writeText(currentClient.referral_code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    });
  }

  async function handleCreditAction() {
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) return;

    setCreditLoading(true);
    setCreditMessage(null);
    try {
      let updated: Client;
      if (creditAction === 'add') {
        updated = await addReferralCredit(currentClient.id, amount);
        setCreditMessage({ type: 'success', text: `$${amount.toFixed(2)} credit added successfully.` });
      } else {
        updated = await redeemReferralCredit(currentClient.id, amount);
        setCreditMessage({ type: 'success', text: `$${amount.toFixed(2)} credit redeemed successfully.` });
      }
      setCurrentClient(updated);
      setCreditAction(null);
      setCreditAmount('25');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update credit.';
      setCreditMessage({ type: 'error', text: msg });
    } finally {
      setCreditLoading(false);
    }
  }

  const allActivities = [
    ...(history?.inquiries.map(i => ({ type: 'inquiry', date: i.created_at, data: i })) || []),
    ...(history?.jobs.map(j => ({ type: 'job', date: j.created_at, data: j })) || []),
    ...(history?.invoices.map(inv => ({ type: 'invoice', date: inv.created_at, data: inv })) || []),
    ...(currentClient.last_followup_email_sent_at
      ? [{ type: 'followup_email', date: currentClient.last_followup_email_sent_at, data: null }]
      : [])
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const DOC_TYPE_LABELS: Record<string, string> = {
    invoice: 'Invoice', receipt: 'Receipt', estimate: 'Estimate',
    job_report: 'Job Report', photo: 'Photo', agreement: 'Agreement',
    general: 'General', other: 'Other',
  };

  const DOC_TYPE_COLORS: Record<string, string> = {
    invoice: 'bg-blue-100 text-blue-700',
    receipt: 'bg-green-100 text-green-700',
    estimate: 'bg-yellow-100 text-yellow-700',
    job_report: 'bg-orange-100 text-orange-700',
    photo: 'bg-pink-100 text-pink-700',
    agreement: 'bg-red-100 text-red-700',
    general: 'bg-gray-100 text-gray-700',
    other: 'bg-gray-100 text-gray-600',
  };

  return (
    <Modal isOpen onClose={onClose} title="Client Details" size="large">
      {/* Tab nav */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6 -mt-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeTab === 'documents'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Documents
          {documents.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
              {documents.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Client Documents</h3>
              <p className="text-sm text-gray-500 mt-0.5">Files stored in the secure document vault</p>
            </div>
            {customerId && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </button>
            )}
          </div>

          {/* Loading customer resolution */}
          {(customerIdLoading || (!customerIdResolved)) && (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {/* No customer record found */}
          {customerIdResolved && !customerId && (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">No portal account linked</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Document uploads require a linked customer portal account. This client will be linked once they register or contact you through the portal.
                </p>
              </div>
            </div>
          )}

          {/* Document list */}
          {customerIdResolved && customerId && (
            <>
              {documentsLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : documentsError ? (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {documentsError}
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">No documents yet</p>
                    <p className="text-xs text-gray-500 mt-1">Upload a file to get started</p>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload First Document
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.display_name}</p>
                          <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${DOC_TYPE_COLORS[doc.document_type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                          </span>
                          {doc.is_internal_only ? (
                            <span className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                              <Lock className="w-3 h-3" />
                              Internal
                            </span>
                          ) : doc.is_visible_to_customer ? (
                            <span className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <Eye className="w-3 h-3" />
                              Visible
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(doc.created_at)}</p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleViewDocument(doc)}
                          disabled={viewingDocId === doc.id}
                          title="View"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadDocument(doc)}
                          disabled={viewingDocId === doc.id}
                          title="Download"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === doc.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <span className="text-xs text-red-600 font-medium">Delete?</span>
                            <button
                              onClick={() => handleDeleteDocument(doc)}
                              disabled={deletingDocId === doc.id}
                              className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deletingDocId === doc.id ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(doc.id)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Close */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
      <div className="space-y-6">
        {/* Client Overview */}
        <div className="rounded-2xl border border-indigo-100 shadow-md shadow-indigo-100/60 overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-cyan-50/40">
          {/* Header Band */}
          <div className="bg-gradient-to-r from-indigo-700 via-violet-700 to-cyan-600 px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold text-white tracking-tight whitespace-normal break-words">{currentClient.name}</h2>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md capitalize border ${
                    currentClient.client_status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : currentClient.client_status === 'repeat'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      : currentClient.client_status === 'dormant'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : currentClient.client_status === 'lead'
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                  }`}>
                    {currentClient.client_status}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md capitalize bg-white/15 text-indigo-50 border border-white/30">
                    {currentClient.client_value_tier.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end sm:shrink-0">
                <div className="text-right">
                  <p className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Customer Since</p>
                  <p className="text-base font-semibold text-white mt-0.5">{formatDate(currentClient.first_contact_date)}</p>
                </div>
                {!editingInfo && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingInfo(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={revealDeleteConfirm}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-100 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info — View or Edit */}
          <div className="bg-white px-6 py-5">
            {editingInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                      placeholder="123 Main St, City, State"
                    />
                  </div>
                </div>
                {saveInfoError && (
                  <p className="text-sm text-red-600">{saveInfoError}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveInfo}
                    disabled={savingInfo || !editName.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {savingInfo ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={savingInfo}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentClient.email && (
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-50 to-white rounded-xl border border-indigo-100">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded-md border border-indigo-200 shadow-sm">
                      <Mail className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider leading-none mb-0.5">Email</p>
                      <a
                        href={getEmailHref(currentClient.email)}
                        className="block text-sm font-medium text-slate-800 break-all underline decoration-indigo-200 hover:text-indigo-700 hover:decoration-indigo-400 transition-colors"
                        title="Send email"
                      >
                        {currentClient.email}
                      </a>
                    </div>
                  </div>
                )}
                {currentClient.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-cyan-50 to-white rounded-xl border border-cyan-100">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded-md border border-cyan-200 shadow-sm">
                      <Phone className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-cyan-500 uppercase tracking-wider leading-none mb-0.5">Phone</p>
                      <a
                        href={getPhoneHref(currentClient.phone)}
                        className="text-sm font-medium text-slate-800 underline decoration-cyan-200 hover:text-cyan-700 hover:decoration-cyan-400 transition-colors"
                        title="Call client"
                      >
                        {currentClient.phone}
                      </a>
                    </div>
                  </div>
                )}
                {currentClient.address && (
                  <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-violet-50 to-white rounded-xl border border-violet-100">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded-md border border-violet-200 shadow-sm">
                      <MapPin className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-violet-500 uppercase tracking-wider leading-none mb-0.5">Location</p>
                      <a
                        href={getAddressDirectionsUrl(currentClient.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm font-medium text-slate-800 break-words underline decoration-violet-200 hover:text-violet-700 hover:decoration-violet-400 transition-colors"
                        title="Open directions in Maps"
                      >
                        {currentClient.address}
                      </a>
                    </div>
                  </div>
                )}
                {currentClient.source && (
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-white rounded-xl border border-emerald-100">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded-md border border-emerald-200 shadow-sm">
                      <FileText className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-emerald-500 uppercase tracking-wider leading-none mb-0.5">Lead Source</p>
                      <p className="text-sm font-medium text-slate-800 capitalize">{currentClient.source.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )}
                {!currentClient.email && !currentClient.phone && !currentClient.address && !currentClient.source && (
                  <p className="text-sm text-slate-400 col-span-2">No contact information on file.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/40 border border-emerald-100 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <DollarSign className="w-4 h-4" />
              <p className="text-sm font-medium">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-emerald-900">{formatCurrency(currentClient.total_revenue)}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/40 border border-indigo-100 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 text-indigo-700 mb-1">
              <Briefcase className="w-4 h-4" />
              <p className="text-sm font-medium">Number of Jobs</p>
            </div>
            <p className="text-2xl font-bold text-indigo-900">{currentClient.job_count}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-cyan-50 via-white to-cyan-100/40 border border-cyan-100 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 text-cyan-700 mb-1">
              <DollarSign className="w-4 h-4" />
              <p className="text-sm font-medium">Avg Job Value</p>
            </div>
            <p className="text-2xl font-bold text-cyan-900">{formatCurrency(currentClient.job_count > 0 ? currentClient.total_revenue / currentClient.job_count : 0)}</p>
          </div>
        </div>

        {/* Follow-Up Email */}
        {currentClient.email && (
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Post-Job Follow-Up</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Send a thank-you email with a Google review link</p>
                </div>
              </div>
              <button
                onClick={handleSendFollowup}
                disabled={followupSending || followupCooldownRemaining > 0}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {followupSending
                  ? 'Sending...'
                  : followupCooldownRemaining > 0
                  ? `Available in ${followupCooldownRemaining >= 60 ? `${Math.ceil(followupCooldownRemaining / 60)}m` : `${followupCooldownRemaining}s`}`
                  : 'Send Follow-Up'}
              </button>
            </div>
            {followupMessage && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${followupMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {followupMessage.text}
              </div>
            )}
            {followupCooldownRemaining > 0 && !followupMessage && (
              <p className="mt-2 text-xs text-gray-500">
                Last sent {currentClient.last_followup_email_sent_at ? formatDateTime(currentClient.last_followup_email_sent_at) : ''}. Can resend after cooldown.
              </p>
            )}
          </div>
        )}

        {/* Send Quote Email */}
        {currentClient.email && history && history.jobs.filter((j: any) => j.quoted_price != null).length > 0 && (
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-base font-semibold text-gray-900">Send Quote Email</h3>
                <p className="text-sm text-gray-500 mt-0.5">Send a pricing quote for a selected job (valid 7 days)</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Select Job</label>
                <div className="relative">
                  <select
                    value={selectedQuoteJobId}
                    onChange={(e) => { setSelectedQuoteJobId(e.target.value); setQuoteMessage(null); }}
                    disabled={quoteCooldownRemaining > 0}
                    className="w-full appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">— Choose a job with a quote —</option>
                    {history.jobs.filter((j: any) => j.quoted_price != null).map((job: any) => (
                      <option key={job.id} value={job.id}>
                        {job.job_type || 'Job'} — ${Number(job.quoted_price).toFixed(0)} — {formatDate(job.created_at)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSendQuoteEmail}
                  disabled={!selectedQuoteJobId || quoteSending || quoteCooldownRemaining > 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {quoteSending
                    ? 'Sending...'
                    : quoteCooldownRemaining > 0
                    ? `Available in ${quoteCooldownRemaining >= 60 ? `${Math.ceil(quoteCooldownRemaining / 60)}m` : `${quoteCooldownRemaining}s`}`
                    : 'Send Quote'}
                </button>
              </div>

              {quoteMessage && (
                <div className={`px-3 py-2 rounded-lg text-sm ${quoteMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {quoteMessage.text}
                </div>
              )}
              {quoteCooldownRemaining > 0 && !quoteMessage && (
                <p className="text-xs text-gray-500">
                  Last sent {currentClient.last_quote_email_sent_at ? formatDateTime(currentClient.last_quote_email_sent_at) : ''}. Can resend after cooldown.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Send Invoice by Email */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">Send Invoice by Email</h3>
              <p className="text-sm text-gray-500 mt-0.5">Select a job, review or edit the invoice, then send a payment link</p>
            </div>
          </div>

          {history && history.jobs.length > 0 ? (
            <div className="space-y-3">
              {/* Job selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Select Job</label>
                <div className="relative">
                  <select
                    value={selectedJobId}
                    onChange={(e) => handleJobSelected(e.target.value)}
                    disabled={invoiceCooldownRemaining > 0}
                    className="w-full appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">— Choose a job —</option>
                    {history.jobs.map((job: any) => (
                      <option key={job.id} value={job.id}>
                        {job.job_type || 'Job'} — {job.job_status} — {formatDate(job.created_at)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Invoice status hint */}
              {selectedJobId && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${selectedInvoiceId ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  {selectedInvoiceId
                    ? 'Existing invoice found. Review or edit it before sending.'
                    : 'No invoice found for this job. Create one using the Review / Edit Invoice button.'}
                </div>
              )}

              {/* Email override when no client email */}
              {selectedJobId && !currentClient.email && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Recipient Email <span className="text-red-500">*</span>
                    <span className="ml-1 text-gray-400 font-normal">(client has no email on file)</span>
                  </label>
                  <input
                    type="email"
                    value={invoiceEmailOverride}
                    onChange={(e) => setInvoiceEmailOverride(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              )}

              {/* Action buttons */}
              {selectedJobId && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={async () => { await resolveBusinessId(); setShowInvoiceForm(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {selectedInvoiceId ? 'Review / Edit Invoice' : 'Create Invoice'}
                  </button>
                  {invoiceReviewed && (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      Invoice reviewed
                    </span>
                  )}
                </div>
              )}

              {/* Send button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSendInvoiceEmail}
                  disabled={
                    !selectedInvoiceId ||
                    !invoiceReviewed ||
                    invoiceSending ||
                    invoiceCooldownRemaining > 0 ||
                    (!currentClient.email && !invoiceEmailOverride.trim())
                  }
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {invoiceSending
                    ? 'Sending...'
                    : invoiceCooldownRemaining > 0
                    ? `Available in ${invoiceCooldownRemaining >= 60 ? `${Math.ceil(invoiceCooldownRemaining / 60)}m` : `${invoiceCooldownRemaining}s`}`
                    : 'Send Invoice Email'}
                </button>
              </div>

              {invoiceMessage && (
                <div className={`px-3 py-2 rounded-lg text-sm ${invoiceMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {invoiceMessage.text}
                </div>
              )}
              {invoiceCooldownRemaining > 0 && !invoiceMessage && (
                <p className="text-xs text-gray-500">
                  Last sent {currentClient.last_invoice_email_sent_at ? formatDateTime(currentClient.last_invoice_email_sent_at) : ''}. Can resend after cooldown.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No jobs found for this client. Jobs are required to send an invoice email.
            </div>
          )}
        </div>

        {/* Referral Program */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Referral Program</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
              <p className="text-xs font-medium text-blue-700 mb-1">Referral Code</p>
              {currentClient.referral_code ? (
                <button
                  onClick={copyReferralCode}
                  className="flex items-center gap-1.5 mx-auto px-3 py-1.5 text-sm font-mono font-bold text-blue-800 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {codeCopied ? 'Copied!' : currentClient.referral_code}
                </button>
              ) : (
                <span className="text-xs text-gray-400">Not assigned</span>
              )}
            </div>
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-center">
              <p className="text-xs font-medium text-green-700 mb-1">Available Credit</p>
              <p className="text-xl font-bold text-green-800">${(currentClient.referral_credit_balance ?? 0).toFixed(2)}</p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <p className="text-xs font-medium text-gray-600 mb-1">Lifetime Redeemed</p>
              <p className="text-xl font-bold text-gray-800">${(currentClient.referral_credit_used ?? 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Referred Clients */}
          {referredClients.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-medium text-gray-700">Clients Referred ({referredClients.length})</p>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {referredClients.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credit Management */}
          <div className="border-t border-gray-100 pt-4">
            {creditMessage && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${creditMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {creditMessage.text}
              </div>
            )}

            {creditAction ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 font-medium">
                  {creditAction === 'add' ? 'Add' : 'Redeem'} $
                </span>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleCreditAction}
                  disabled={creditLoading}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creditLoading ? 'Saving...' : 'Confirm'}
                </button>
                <button
                  onClick={() => { setCreditAction(null); setCreditMessage(null); }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => { setCreditAction('add'); setCreditMessage(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Credit
                </button>
                <button
                  onClick={() => { setCreditAction('redeem'); setCreditMessage(null); }}
                  disabled={(currentClient.referral_credit_balance ?? 0) <= 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Redeem Credit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Marketing Preferences */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Email Marketing</p>
                  <p className="text-sm text-gray-600">Receive promotional emails</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEmailOptIn(!emailOptIn);
                  handleUpdatePreferences();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  emailOptIn ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailOptIn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {currentClient.last_campaign_date && (
              <p className="text-sm text-gray-600 mt-4">
                Last campaign: {formatDate(currentClient.last_campaign_date)}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {currentClient.tags && currentClient.tags.length > 0 ? (
              currentClient.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            ) : (
              <p className="text-sm text-gray-500">No tags yet</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Tag
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : allActivities.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No activity history</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {allActivities.map((activity, index) => (
                <div key={`${activity.type}-${index}`} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === 'inquiry' ? 'bg-blue-100' :
                      activity.type === 'job' ? 'bg-green-100' :
                      activity.type === 'followup_email' ? 'bg-sky-100' :
                      'bg-gray-100'
                    }`}>
                      {activity.type === 'inquiry' ? <Mail className="w-4 h-4 text-blue-600" /> :
                       activity.type === 'job' ? <Briefcase className="w-4 h-4 text-green-600" /> :
                       activity.type === 'followup_email' ? <Send className="w-4 h-4 text-sky-600" /> :
                       <DollarSign className="w-4 h-4 text-gray-600" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.type === 'inquiry' && 'Form Inquiry'}
                      {activity.type === 'job' && `Job: ${activity.data.job_type || 'General'}`}
                      {activity.type === 'invoice' && `Invoice ${activity.data.invoice_number || ''}`}
                      {activity.type === 'followup_email' && 'Thank-You Email Sent'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {activity.type === 'inquiry' && `${activity.data.furniture_type || 'General inquiry'} - ${activity.data.pieces || 0} pieces`}
                      {activity.type === 'job' && `${activity.data.job_description || 'No description'} - ${activity.data.job_status || 'pending'}`}
                      {activity.type === 'invoice' && `${activity.data.status} - ${formatCurrency(activity.data.total_amount || 0)}`}
                      {activity.type === 'followup_email' && 'Post-job follow-up email delivered'}
                    </p>
                    {activity.type === 'job' && hasSeparateWorkAddress(activity.data) && (
                      <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="break-words">Worked at {resolveWorkAddress(activity.data)}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(activity.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Relationship Notes</h3>

          {/* Add Note Form */}
          <div className="mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this client..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900">{note.note}</p>
                  <p className="text-xs text-gray-500 mt-2">{formatDateTime(note.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Re-engagement Suggestions (for dormant clients) */}
        {currentClient.client_status === 'dormant' && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-900">Re-engagement Opportunity</h4>
                <p className="text-sm text-orange-700 mt-1">
                  This client hasn't been contacted in over 90 days. Consider reaching out with:
                </p>
                <ul className="text-sm text-orange-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Seasonal promotion or special offer</li>
                  <li>Check-in on previous work</li>
                  <li>New service announcement</li>
                  <li>Personalized loyalty discount</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div ref={dangerZoneRef} className="border border-red-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">Danger Zone</span>
            </div>
            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Client
              </button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="px-5 py-5 bg-white space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">This action is permanent and cannot be undone</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
                    <li>The client record and all notes will be deleted</li>
                    <li>Jobs and invoices linked to this client will be unlinked but kept</li>
                    <li>Referral attributions from this client will be cleared</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Type <span className="font-semibold text-gray-900">{currentClient.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={currentClient.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  autoComplete="off"
                />
              </div>

              {deleteError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {deleteError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handlePermanentDelete}
                  disabled={deleteConfirmText !== currentClient.name || deleting}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? (
                    <>
                      <LoadingSpinner />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Permanently Delete
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
      )}

      {showUploadModal && customerId && (
        <AdminDocumentUploadModal
          customers={customers}
          preselectedCustomerId={customerId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            loadDocuments(customerId);
          }}
        />
      )}

      {showInvoiceForm && businessId && (
        <InvoiceFormModal
          businessId={businessId}
          invoice={invoiceForEdit}
          jobId={invoiceForEdit ? undefined : selectedJobId}
          initialData={invoiceForEdit ? undefined : {
            client_name: currentClient.name,
            client_email: currentClient.email ?? undefined,
            client_phone: currentClient.phone ?? undefined,
            client_address: currentClient.address ?? undefined,
          }}
          onClose={() => setShowInvoiceForm(false)}
          onSaved={async () => {
            setShowInvoiceForm(false);
            setInvoiceReviewed(true);
            if (selectedJobId) {
              const { supabase } = await import('../../lib/supabase');
              const { data } = await supabase
                .from('invoices')
                .select('*')
                .eq('job_id', selectedJobId)
                .eq('is_active', true)
                .not('status', 'in', '("cancelled")')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (data) {
                setSelectedInvoiceId(data.id);
                setInvoiceForEdit(data);
              }
            }
          }}
        />
      )}
    </Modal>
  );
}
