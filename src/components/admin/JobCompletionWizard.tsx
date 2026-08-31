import React, { useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Camera, FileText, Star, PenTool, Calendar, AlertCircle, Download, Share2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { supabase, Job } from '../../lib/supabase';
import SignatureCapture from './SignatureCapture';
import SatisfactionRating from './SatisfactionRating';
import { PhotoFile, downloadPhoto, sharePhoto, openPhotoInNewTab, isIOS, isMobileDevice, canShare } from '../../utils/photoDownload';
import { hasSeparateWorkAddress, resolveWorkAddress } from '../../utils/jobAddress';

type WizardStep = 'review' | 'checklist' | 'photos' | 'satisfaction' | 'signature' | 'notes' | 'reminders' | 'confirm';

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
};

type JobCompletionWizardProps = {
  job: Job;
  onClose: () => void;
  onSuccess: () => void;
};

export default function JobCompletionWizard({ job, onClose, onSuccess }: JobCompletionWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('review');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);

  const [finalPrice, setFinalPrice] = useState(job.final_price?.toString() || '');
  const [hoursWorked, setHoursWorked] = useState(job.hours_worked?.toString() || '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: '1', label: 'All furniture assembled correctly', checked: false, required: true },
    { id: '2', label: 'Work area cleaned up', checked: false, required: true },
    { id: '3', label: 'Customer walkthrough completed', checked: false, required: true },
    { id: '4', label: 'Assembly instructions provided', checked: false, required: false },
    { id: '5', label: 'Tools and materials accounted for', checked: false, required: false },
  ]);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [satisfactionRating, setSatisfactionRating] = useState(5);
  const [satisfactionComment, setSatisfactionComment] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [createReminder, setCreateReminder] = useState(true);
  const [reminderDate, setReminderDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  });
  const [reminderType, setReminderType] = useState<'follow_up_call' | 'warranty_check' | 'repeat_business' | 'custom'>('follow_up_call');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const steps: WizardStep[] = ['review', 'checklist', 'photos', 'satisfaction', 'signature', 'notes', 'reminders', 'confirm'];
  const currentStepIndex = steps.indexOf(currentStep);
  const onMobile = isMobileDevice();

  const stepTitles: Record<WizardStep, string> = {
    review: 'Review Job Details',
    checklist: 'Work Completion Checklist',
    photos: 'Upload Completion Photos',
    satisfaction: 'Customer Satisfaction',
    signature: 'Customer Signature',
    notes: 'Admin Notes',
    reminders: 'Follow-up Reminders',
    confirm: 'Review & Confirm',
  };

  const stepIcons: Record<WizardStep, any> = {
    review: FileText,
    checklist: Check,
    photos: Camera,
    satisfaction: Star,
    signature: PenTool,
    notes: FileText,
    reminders: Calendar,
    confirm: Check,
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'review':
        return (
          finalPrice !== '' && parseFloat(finalPrice) >= 0 &&
          hoursWorked !== '' && parseFloat(hoursWorked) > 0
        );
      case 'checklist':
        return checklist.filter(item => item.required).every(item => item.checked);
      case 'satisfaction':
        return satisfactionRating > 0;
      case 'signature':
        return signatureData.length > 0;
      default:
        return true;
    }
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 10) {
      alert('Maximum 10 photos allowed');
      input.value = '';
      return;
    }

    const newPhotos: PhotoFile[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const reader = new FileReader();
      const photoPromise = new Promise<PhotoFile>((resolve) => {
        reader.onloadend = () => {
          resolve({
            file,
            dataUrl: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
      newPhotos.push(await photoPromise);
    }

    setPhotos([...photos, ...newPhotos]);
    // Clear the input so re-picking the same file, or taking a second photo,
    // still fires a change event.
    input.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSharePhoto = async (photo: PhotoFile, index: number) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedClientName = job.client_name.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `job-completion-${sanitizedClientName}-${timestamp}-photo-${index + 1}.jpg`;

    const shared = await sharePhoto(photo.dataUrl, filename);
    if (!shared) {
      downloadPhoto(photo.dataUrl, filename);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: bizData } = await supabase
        .from('business_info')
        .select('organization_id')
        .eq('id', job.business_id)
        .maybeSingle();

      const completedAt = new Date().toISOString();
      const parsedFinalPrice = parseFloat(finalPrice);
      const finalPriceValue = Number.isNaN(parsedFinalPrice) ? null : parsedFinalPrice;
      const hoursWorkedValue = parseFloat(hoursWorked);

      // jobs requires positive hours_worked once a completion date is set, and
      // inserting the completion stamps that date, so save the numbers first.
      const { error: jobDetailsError } = await supabase
        .from('jobs')
        .update({
          hours_worked: hoursWorkedValue,
          final_price: finalPriceValue,
        })
        .eq('id', job.id);

      if (jobDetailsError) throw jobDetailsError;

      const completionData = {
        organization_id: bizData?.organization_id ?? null,
        job_id: job.id,
        completed_at: completedAt,
        completed_by: user?.id || null,
        signature_data: signatureData,
        completion_checklist: checklist,
        completion_photos: [],
        admin_notes: adminNotes,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          timestamp: new Date().toISOString(),
        },
        customer_name: job.client_name,
        final_price: finalPriceValue,
        is_customer_satisfied: satisfactionRating >= 4,
      };

      const { data: completion, error: completionError } = await supabase
        .from('job_completions')
        .insert([completionData])
        .select()
        .single();

      if (completionError) throw completionError;

      // The signed completion is what makes the job done, so close it out here
      // instead of leaving the status to be corrected by hand afterwards.
      const { error: jobStatusError } = await supabase
        .from('jobs')
        .update({
          job_status: 'completed',
          date_completed: completedAt.split('T')[0],
          completion_id: completion.id,
          has_signature: true,
          signed_off_at: completedAt,
          status_changed_by: user?.id || null,
        })
        .eq('id', job.id);

      if (jobStatusError) throw jobStatusError;

      if (photos.length > 0) {
        const completionPhotos = photos.map(photo => photo.dataUrl);
        const { error: completionPhotosError } = await supabase
          .from('job_completions')
          .update({ completion_photos: completionPhotos })
          .eq('id', completion.id);

        if (completionPhotosError) {
          console.error('Error saving completion photos:', completionPhotosError);
        }
      }

      if (satisfactionComment.trim()) {
        const reviewData = {
          business_id: job.business_id,
          author_name: job.client_name,
          review_body: satisfactionComment,
          rating_value: satisfactionRating,
          date_published: new Date().toISOString().split('T')[0],
          is_featured: satisfactionRating >= 4,
          is_verified: true,
          is_active: true,
          job_completion_id: completion.id,
          source: 'job_completion',
          collected_at_completion: true,
        };

        const { error: reviewError } = await supabase
          .from('customer_reviews')
          .insert([reviewData]);

        if (reviewError) console.error('Error creating review:', reviewError);
      }

      if (createReminder) {
        const reminderData = {
          job_completion_id: completion.id,
          job_id: job.id,
          reminder_type: reminderType,
          scheduled_date: reminderDate,
          status: 'pending',
          admin_notes: `Follow up for: ${job.client_name}`,
          created_by: user?.id || null,
        };

        const { error: reminderError } = await supabase
          .from('job_completion_reminders')
          .insert([reminderData]);

        if (reminderError) console.error('Error creating reminder:', reminderError);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error submitting completion:', err);
      setError(err.message || 'Failed to submit completion');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'review':
        return (
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600">Client Name</label>
                <p className="text-lg font-semibold text-slate-900">{job.client_name}</p>
              </div>
              {job.client_phone && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Phone</label>
                  <p className="text-lg text-slate-900">{job.client_phone}</p>
                </div>
              )}
              {job.job_type && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Job Type</label>
                  <p className="text-lg text-slate-900">{job.job_type}</p>
                </div>
              )}
              {resolveWorkAddress(job) && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Work Location</label>
                  <p className="text-lg text-slate-900">{resolveWorkAddress(job)}</p>
                  {hasSeparateWorkAddress(job) && (
                    <p className="text-xs text-amber-700 mt-0.5">Different from the client's address</p>
                  )}
                </div>
              )}
              {job.job_description && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Description</label>
                  <p className="text-slate-900">{job.job_description}</p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="final-price" className="block text-sm font-semibold text-slate-900 mb-2">
                  Final Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">$</span>
                  <input
                    id="final-price"
                    type="number"
                    step="0.01"
                    value={finalPrice}
                    onChange={(e) => setFinalPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hours-worked" className="block text-sm font-semibold text-slate-900 mb-2">
                  Hours Worked <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="hours-worked"
                    type="number"
                    step="0.25"
                    min="0"
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-4 pr-14 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">hrs</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Required before a job can be marked completed.
                </p>
              </div>
            </div>
          </div>
        );

      case 'checklist':
        return (
          <div className="space-y-4">
            {checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <input name="checked"
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => {
                    setChecklist(checklist.map(i =>
                      i.id === item.id ? { ...i, checked: e.target.checked } : i
                    ));
                  }}
                  className="mt-1 w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="text-slate-900 font-medium">{item.label}</span>
                  {item.required && (
                    <span className="ml-2 text-xs text-red-500">Required</span>
                  )}
                </div>
              </label>
            ))}

            {!checklist.filter(item => item.required).every(item => item.checked) && (
              <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-900">
                  All required items must be checked before proceeding
                </p>
              </div>
            )}
          </div>
        );

      case 'photos':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Upload Photos (Optional, max 10)
              </label>
              <input name="file"
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <input name="file"
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className={`grid gap-3 ${onMobile ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={photos.length >= 10}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-5 h-5" />
                  {onMobile ? 'Choose from Gallery' : 'Choose Files'}
                </button>
                {onMobile && (
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={photos.length >= 10}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-5 h-5" />
                    Take Photo
                  </button>
                )}
              </div>

              {photos.length >= 10 && (
                <p className="mt-2 text-xs text-slate-500">
                  Photo limit reached (10 of 10)
                </p>
              )}

              {isIOS() && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-900 font-medium mb-1">iPhone Users:</p>
                  <p className="text-xs text-blue-800">
                    After uploading, tap the blue Share button on each photo and select "Save to Photos" from the menu
                  </p>
                </div>
              )}
            </div>

            {photos.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex gap-3">
                        <img
                          src={photo.dataUrl}
                          alt={`Photo ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Photo {index + 1}</p>
                            <p className="text-xs text-slate-500">{photo.file.name}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {canShare() && (
                              <button
                                onClick={() => handleSharePhoto(photo, index)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                {isIOS() ? 'Save to Photos' : 'Share'}
                              </button>
                            )}
                            {isIOS() && (
                              <button
                                onClick={() => openPhotoInNewTab(photo.dataUrl)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open & Save
                              </button>
                            )}
                            {!isIOS() && (
                              <button
                                onClick={() => {
                                  const timestamp = new Date().toISOString().split('T')[0];
                                  const sanitizedClientName = job.client_name.replace(/[^a-zA-Z0-9]/g, '-');
                                  const filename = `job-completion-${sanitizedClientName}-${timestamp}-photo-${index + 1}.jpg`;
                                  downloadPhoto(photo.dataUrl, filename);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </button>
                            )}
                            <button
                              onClick={() => removePhoto(index)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors ml-auto"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case 'satisfaction':
        return (
          <SatisfactionRating
            rating={satisfactionRating}
            comment={satisfactionComment}
            onRatingChange={setSatisfactionRating}
            onCommentChange={setSatisfactionComment}
          />
        );

      case 'signature':
        return (
          <div className="space-y-6">
            {signatureData ? (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-6">
                  <img src={signatureData} alt="Customer signature" className="max-w-full h-48 mx-auto" />
                </div>
                <button
                  onClick={() => setShowSignatureCapture(true)}
                  className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Recapture Signature
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <PenTool className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-6">Customer signature required to complete job</p>
                <button
                  onClick={() => setShowSignatureCapture(true)}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors text-lg"
                >
                  Capture Signature
                </button>
              </div>
            )}
          </div>
        );

      case 'notes':
        return (
          <div className="space-y-4">
            <label htmlFor="admin-notes" className="block text-sm font-semibold text-slate-900">
              Admin Notes (Optional)
            </label>
            <textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={8}
              placeholder="Any additional notes about the job completion, warranty information, or follow-up needed..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
          </div>
        );

      case 'reminders':
        return (
          <div className="space-y-6">
            <label className="flex items-center gap-3">
              <input name="createReminder"
                type="checkbox"
                checked={createReminder}
                onChange={(e) => setCreateReminder(e.target.checked)}
                className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-slate-900 font-medium">Create follow-up reminder</span>
            </label>

            {createReminder && (
              <div className="space-y-4 pl-8">
                <div>
                  <label htmlFor="reminder-type" className="block text-sm font-semibold text-slate-900 mb-2">
                    Reminder Type
                  </label>
                  <select
                    id="reminder-type"
                    value={reminderType}
                    onChange={(e) => setReminderType(e.target.value as any)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="follow_up_call">Follow-up Call (1 week)</option>
                    <option value="warranty_check">Warranty Check (30 days)</option>
                    <option value="repeat_business">Repeat Business Outreach (6 months)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reminder-date" className="block text-sm font-semibold text-slate-900 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    id="reminder-date"
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <h3 className="font-semibold text-emerald-900 mb-4">Completion Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-emerald-700">Client:</span>
                  <span className="font-medium text-emerald-900">{job.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Final Price:</span>
                  <span className="font-medium text-emerald-900">${finalPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Hours Worked:</span>
                  <span className="font-medium text-emerald-900">{hoursWorked} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Satisfaction Rating:</span>
                  <span className="font-medium text-emerald-900">{satisfactionRating}/5 stars</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Checklist Items:</span>
                  <span className="font-medium text-emerald-900">
                    {checklist.filter(i => i.checked).length}/{checklist.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Photos:</span>
                  <span className="font-medium text-emerald-900">{photos.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Signature:</span>
                  <span className="font-medium text-emerald-900">
                    {signatureData ? 'Captured' : 'Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Job Status:</span>
                  <span className="font-medium text-emerald-900">Completed</span>
                </div>
                {createReminder && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700">Reminder:</span>
                    <span className="font-medium text-emerald-900">{reminderType} on {reminderDate}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-600 text-center">
              Review the information above and click Complete Job to finalize. The job
              is marked completed for you — no need to edit the status afterwards.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const StepIcon = stepIcons[currentStep];

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Complete Job</h2>
                <p className="text-sm text-slate-600 mt-1">{job.client_name}</p>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    index === currentStepIndex
                      ? 'bg-emerald-600 text-white'
                      : index < currentStepIndex
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="w-4 h-4 flex items-center justify-center text-xs">
                      {index + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{stepTitles[step]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <StepIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{stepTitles[currentStep]}</h3>
                <p className="text-sm text-slate-600">
                  Step {currentStepIndex + 1} of {steps.length}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {renderStepContent()}
          </div>

          <div className="p-6 border-t border-slate-200 flex gap-3">
            {currentStepIndex > 0 && (
              <button
                onClick={prevStep}
                disabled={submitting}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
            )}

            {currentStepIndex < steps.length - 1 ? (
              <button
                onClick={nextStep}
                disabled={!canProceed() || submitting}
                className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || submitting}
                className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Completing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Complete Job
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {showSignatureCapture && (
        <SignatureCapture
          onSave={(data) => {
            setSignatureData(data);
            setShowSignatureCapture(false);
          }}
          onCancel={() => setShowSignatureCapture(false)}
          initialSignature={signatureData}
        />
      )}
    </>
  );
}
