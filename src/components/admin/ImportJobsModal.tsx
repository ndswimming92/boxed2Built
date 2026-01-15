import React, { useState, useRef } from 'react';
import { supabase, ServiceArea, PaymentMethod, Job } from '../../lib/supabase';
import { X, Upload, Download, AlertCircle, CheckCircle, FileText, AlertTriangle } from 'lucide-react';
import { validateCSVData, generateErrorReportCSV, ValidationError } from '../../services/jobImportService';
import { generateCSVTemplate, downloadCSV } from '../../services/jobExportService';

interface ImportJobsModalProps {
  businessId: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

type ImportStep = 'upload' | 'validation' | 'preview' | 'importing' | 'success';

export default function ImportJobsModal({ businessId, onClose, onSuccess }: ImportJobsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validJobs, setValidJobs] = useState<Partial<Job>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    downloadCSV(template, 'job-import-template.csv');
  };

  const handleDownloadErrorReport = () => {
    const errorCSV = generateErrorReportCSV(validationErrors);
    downloadCSV(errorCSV, 'import-errors.csv');
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setError(null);

    const content = await selectedFile.text();

    const [areasRes, paymentsRes] = await Promise.all([
      supabase.from('service_areas').select('*').eq('is_active', true),
      supabase.from('payment_methods').select('*').eq('business_id', businessId).eq('is_active', true)
    ]);

    const serviceAreas: ServiceArea[] = areasRes.data || [];
    const paymentMethods: PaymentMethod[] = paymentsRes.data || [];

    const result = await validateCSVData(content, serviceAreas, paymentMethods);

    setValidationErrors(result.errors);
    setValidJobs(result.validRows);
    setTotalRows(result.totalRows);

    if (result.isValid) {
      setStep('preview');
    } else {
      setStep('validation');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    setError(null);

    try {
      const jobsToInsert = validJobs.map(job => ({
        ...job,
        business_id: businessId,
      }));

      const { error: insertError } = await supabase
        .from('jobs')
        .insert(jobsToInsert);

      if (insertError) throw insertError;

      setStep('success');
      setTimeout(() => {
        onSuccess(validJobs.length);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error importing jobs:', err);
      setError(err.message || 'Failed to import jobs');
    } finally {
      setImporting(false);
    }
  };

  const renderUploadStep = () => (
    <div className="p-6">
      <div className="mb-6 text-center">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Import Jobs from CSV</h3>
        <p className="text-sm text-slate-600">Upload a CSV file with your job data</p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleDownloadTemplate}
          className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg text-blue-700 font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download CSV Template
        </button>
        <p className="mt-2 text-xs text-slate-500 text-center">
          Download the template to see the required format and example data
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      >
        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-slate-700 mb-2">
          {isDragging ? 'Drop your file here' : 'Drag and drop your CSV file'}
        </p>
        <p className="text-sm text-slate-500 mb-4">or</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
        >
          Browse Files
        </button>
        <input name="file"
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );

  const renderValidationStep = () => (
    <div className="p-6">
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Validation Errors Found</h3>
        <p className="text-sm text-slate-600">
          Found {validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''} in {totalRows} row{totalRows !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleDownloadErrorReport}
          className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg text-blue-700 font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Error Report
        </button>
        <p className="mt-2 text-xs text-slate-500 text-center">
          Download a detailed report of all errors to help fix your CSV file
        </p>
      </div>

      <div className="bg-slate-50 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Row</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Field</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Error</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Current Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {validationErrors.map((error, index) => (
              <tr key={index} className="hover:bg-slate-100">
                <td className="px-4 py-3 text-sm text-slate-900">{error.row}</td>
                <td className="px-4 py-3 text-sm text-slate-900">{error.field}</td>
                <td className="px-4 py-3 text-sm text-red-600">{error.message}</td>
                <td className="px-4 py-3 text-sm text-slate-600 font-mono text-xs">
                  {error.currentValue || '(empty)'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Please fix these errors before importing</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Update your CSV file with the correct values</li>
              <li>Make sure dates are in MM/DD/YYYY or YYYY-MM-DD format</li>
              <li>Verify all required fields have values</li>
              <li>Check that cities and payment methods match your settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="p-6">
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to Import</h3>
        <p className="text-sm text-slate-600">
          {validJobs.length} job{validJobs.length !== 1 ? 's' : ''} validated successfully
        </p>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Preview (First 10 Rows)</h4>
        <div className="bg-slate-50 rounded-lg border border-slate-200 max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Client</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Job Type</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Date</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Price</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {validJobs.slice(0, 10).map((job, index) => (
                <tr key={index} className="hover:bg-slate-100">
                  <td className="px-3 py-2 text-slate-900">{job.client_name}</td>
                  <td className="px-3 py-2 text-slate-600">{job.job_type || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{job.date_completed || '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    ${job.final_price?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{job.location_city || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {validJobs.length > 10 && (
          <p className="mt-2 text-xs text-slate-500 text-center">
            ...and {validJobs.length - 10} more job{validJobs.length - 10 !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Ready to proceed</p>
            <p className="text-xs">
              Click "Confirm Import" to add these {validJobs.length} job{validJobs.length !== 1 ? 's' : ''} to your database.
              This action cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );

  const renderSuccessStep = () => (
    <div className="p-6 text-center">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">Import Successful!</h3>
      <p className="text-sm text-slate-600">
        Successfully imported {validJobs.length} job{validJobs.length !== 1 ? 's' : ''}
      </p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold text-slate-900">Import Jobs</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={importing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && renderUploadStep()}
          {step === 'validation' && renderValidationStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'success' && renderSuccessStep()}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'validation' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
              >
                Try Another File
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
              >
                Close
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                disabled={importing}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={importing}
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Confirm Import
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
