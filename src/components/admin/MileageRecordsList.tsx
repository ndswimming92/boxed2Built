import React, { useState, useEffect } from 'react';
import { MapPin, Edit2, Trash2, Navigation, DollarSign, Calendar, Plus, Download } from 'lucide-react';
import { mileageTracker } from '../../services/mileageTrackingService';
import type { MileageRecord } from '../../lib/supabase';
import MileageRecordModal from './MileageRecordModal';
import { exportMileageToCSV, exportMileageToIRSFormat, downloadCSV, generateExportFilename } from '../../services/mileageExportService';

interface MileageRecordsListProps {
  jobId: string;
  businessId: string;
  onUpdate?: () => void;
}

export default function MileageRecordsList({ jobId, businessId, onUpdate }: MileageRecordsListProps) {
  const [records, setRecords] = useState<MileageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<MileageRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [jobId]);

  const fetchRecords = async () => {
    setLoading(true);
    const data = await mileageTracker.getMileageRecordsForJob(jobId);
    setRecords(data);
    setLoading(false);
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this mileage record?')) {
      return;
    }

    setDeletingId(recordId);
    const result = await mileageTracker.deleteMileageRecord(recordId);

    if (result.success) {
      await fetchRecords();
      if (onUpdate) onUpdate();
    } else {
      alert(`Error deleting record: ${result.error}`);
    }

    setDeletingId(null);
  };

  const handleAddManual = () => {
    setEditingRecord(null);
    setShowModal(true);
  };

  const handleEdit = (record: MileageRecord) => {
    setEditingRecord(record);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingRecord(null);
  };

  const handleSave = async () => {
    await fetchRecords();
    if (onUpdate) onUpdate();
    handleModalClose();
  };

  const handleExportStandard = () => {
    const csv = exportMileageToCSV(records);
    const filename = generateExportFilename('job_mileage', 'standard');
    downloadCSV(csv, filename);
  };

  const handleExportIRS = () => {
    const csv = exportMileageToIRSFormat(records);
    const filename = generateExportFilename('job_mileage', 'irs');
    downloadCSV(csv, filename);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (startTime: string, endTime: string | null) => {
    if (!endTime) return '';

    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const totalMiles = records.reduce((sum, record) => sum + record.distance_miles, 0);
  const totalDeduction = records.reduce((sum, record) => sum + record.deduction_amount, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Navigation className="w-5 h-5 text-blue-600" />
              <span>Mileage Records</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {records.length} {records.length === 1 ? 'trip' : 'trips'} recorded
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {records.length > 0 && (
              <div className="relative group">
                <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={handleExportStandard}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                  >
                    Standard CSV
                  </button>
                  <button
                    onClick={handleExportIRS}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg"
                  >
                    IRS Format CSV
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={handleAddManual}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Manual Entry</span>
            </button>
          </div>
        </div>

        {records.length > 0 && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Distance</div>
              <div className="text-2xl font-bold text-blue-900">
                {totalMiles.toFixed(2)}
                <span className="text-sm ml-1">miles</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Tax Deduction</div>
              <div className="text-2xl font-bold text-green-700">
                ${totalDeduction.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No mileage records yet</p>
          <p className="text-sm text-gray-400">Use GPS tracking or add manual entries</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {records.map((record) => (
            <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`p-2 rounded-lg ${record.is_manual_entry ? 'bg-gray-100' : 'bg-blue-100'}`}>
                      {record.is_manual_entry ? (
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Navigation className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {record.distance_miles.toFixed(2)} miles
                      </div>
                      <div className="text-xs text-gray-500">
                        {record.is_manual_entry ? 'Manual Entry' : 'GPS Tracked'}
                      </div>
                    </div>
                  </div>

                  <div className="ml-14 space-y-1">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(record.trip_date)}</span>
                      {record.end_time && (
                        <span className="text-gray-400">
                          • {formatTime(record.start_time, record.end_time)}
                        </span>
                      )}
                    </div>

                    {record.purpose && (
                      <div className="text-sm text-gray-600">{record.purpose}</div>
                    )}

                    <div className="flex items-center space-x-2 text-sm">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 font-semibold">
                        ${record.deduction_amount.toFixed(2)} deduction
                      </span>
                      <span className="text-gray-400">
                        (${record.irs_rate_per_mile.toFixed(3)}/mi)
                      </span>
                    </div>

                    {record.notes && (
                      <div className="text-sm text-gray-500 italic">{record.notes}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(record)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    disabled={deletingId === record.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <MileageRecordModal
          record={editingRecord}
          jobId={jobId}
          businessId={businessId}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
