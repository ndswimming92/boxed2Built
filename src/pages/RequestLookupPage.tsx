import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import FormField from '../components/ui/FormField';
import ValidationMessage from '../components/ui/ValidationMessage';
import { Search, Download, CheckCircle, Loader2, FileText, Clock, Image, Link, ExternalLink } from 'lucide-react';
import { getSavedRequestByCode } from '../services/savedRequestService';
import { generateRequestSummaryPDF } from '../services/pdfGenerationService';
import { SavedRequest } from '../lib/supabase';
import { trackEvent } from '../utils/analytics';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';

const RequestLookupPage: React.FC = () => {

  usePageMeta({
    title: 'Look Up Your Request - Boxed2Built | Spring Hill Furniture Assembly',
    description: 'Check your furniture assembly request status with Boxed2Built. Quickly access details for your Spring Hill service inquiry.',
    canonicalUrl: 'https://boxed2built.com/lookup-request',
    ogTitle: 'Request Lookup | Boxed2Built',
    ogDescription: 'Need to review your Boxed2Built request? Use the request lookup page to find your inquiry details fast.',
    twitterTitle: 'Boxed2Built Request Lookup',
    twitterDescription: 'Look up your furniture assembly request details with Boxed2Built.',
  });
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState<SavedRequest | null>(null);
  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.requestLookup.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        'content',
        LOCAL_SEO_CONTENT.requestLookup.description
      );
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/lookup-request');

    const searchParams = new URLSearchParams(location.search);
    const codeParam = searchParams.get('code');
    const emailParam = searchParams.get('email');

    if (codeParam) {
      setConfirmationCode(codeParam.toUpperCase());
    }

    if (emailParam) {
      setEmail(emailParam);
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRequest(null);

    if (!email || !confirmationCode) {
      setError('Please enter both your email and confirmation code.');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (confirmationCode.length < 6) {
      setError('Please enter a valid confirmation code.');
      return;
    }

    setLoading(true);

    try {
      const cleanedCode = confirmationCode.replace(/\s/g, '').toUpperCase();
      const savedRequest = await getSavedRequestByCode(email.toLowerCase(), cleanedCode);

      if (savedRequest) {
        setRequest(savedRequest);

        trackEvent('request_lookup_success', 'lookup_page', {
          event_category: 'engagement',
          confirmation_code: cleanedCode,
        });
      } else {
        setError('No request found with the provided email and confirmation code. Please check your information and try again.');

        trackEvent('request_lookup_failed', 'lookup_page', {
          event_category: 'engagement',
        });
      }
    } catch (err) {
      console.error('Error looking up request:', err);
      setError('An error occurred while looking up your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!request) return;

    await generateRequestSummaryPDF({
      confirmationCode: request.confirmation_code,
      clientName: request.client_name,
      clientEmail: request.client_email,
      clientPhone: request.client_phone || undefined,
      furnitureType: request.furniture_type,
      pieces: request.pieces,
      preferredDate: request.preferred_date || undefined,
      preferredTimeSlot: request.preferred_time_slot || undefined,
      notes: request.notes || undefined,
      userCity: request.user_city || undefined,
      estimatedPrice: request.estimated_price || undefined,
      estimatedTime: request.estimated_time || undefined,
      submissionDate: request.submission_date,
    });

    trackEvent('request_summary_downloaded', 'lookup_page', {
      event_category: 'conversion',
      confirmation_code: request.confirmation_code,
    });
  };

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <section className="py-12 bg-gradient-to-br from-blue-50 to-gray-100">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Look Up Request', href: '/lookup-request', current: true },
                ]}
                className="mb-6"
              />

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Look Up Your Request
              </h1>
              <p className="text-xl text-gray-600">
                Enter your email and confirmation code to view your saved service request details.
              </p>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Search size={32} className="text-blue-600" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  Find Your Service Request
                </h2>

                {!request ? (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <FormField
                      label="Email Address"
                      required
                      helpText="Enter the email you used when submitting your request"
                    >
                      <input name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoComplete="email"
                        required
                      />
                    </FormField>

                    <FormField
                      label="Confirmation Code"
                      required
                      helpText="Enter your confirmation code (e.g., SR-ABC123XYZ)"
                    >
                      <input name="confirmationCode"
                        type="text"
                        value={confirmationCode}
                        onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                        placeholder="SR-XXXXXXXXXX"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                        maxLength={20}
                        required
                      />
                    </FormField>

                    {error && (
                      <ValidationMessage type="error" message={error} />
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Looking up request...
                        </>
                      ) : (
                        <>
                          <Search size={20} />
                          Find My Request
                        </>
                      )}
                    </button>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                      <p className="text-sm text-blue-900">
                        <strong>Need help?</strong> If you can't find your confirmation code, please contact us at{' '}
                        <a href="tel:+16154034538" className="text-blue-700 hover:text-blue-800 underline">
                          (615) 403-4538
                        </a>{' '}
                        or{' '}
                        <a href="mailto:boxed2builtco@gmail.com" className="text-blue-700 hover:text-blue-800 underline">
                          boxed2builtco@gmail.com
                        </a>
                      </p>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center mb-4">
                      <CheckCircle size={48} className="text-green-600" />
                    </div>

                    <h3 className="text-xl font-bold text-center text-gray-900 mb-6">
                      Request Found!
                    </h3>

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm font-semibold text-blue-900 mb-1 text-center">
                        Confirmation Code
                      </p>
                      <p className="text-2xl font-bold text-blue-700 text-center">
                        {request.confirmation_code}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                        <FileText size={20} className="mr-2" />
                        Request Details
                      </h4>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Name:</span>
                          <span className="font-semibold text-gray-900">{request.client_name}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-semibold text-gray-900">{request.client_email}</span>
                        </div>

                        {request.client_phone && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Phone:</span>
                            <span className="font-semibold text-gray-900">{request.client_phone}</span>
                          </div>
                        )}

                        {request.user_city && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Location:</span>
                            <span className="font-semibold text-gray-900">{request.user_city}</span>
                          </div>
                        )}

                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Furniture Type:</span>
                            <span className="font-semibold text-gray-900">{request.furniture_type}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Number of Pieces:</span>
                            <span className="font-semibold text-gray-900">{request.pieces}</span>
                          </div>
                        </div>

                        {(request.estimated_price || request.estimated_time) && (
                          <div className="border-t border-gray-200 pt-3 mt-3 bg-green-50 -mx-3 px-3 py-2 rounded">
                            {request.estimated_price && (
                              <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Estimated Cost:</span>
                                <span className="font-bold text-green-700">{request.estimated_price}</span>
                              </div>
                            )}

                            {request.estimated_time && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Estimated Time:</span>
                                <span className="font-bold text-green-700">{request.estimated_time}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {(request.preferred_date || request.preferred_time_slot) && (
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            {request.preferred_date && (
                              <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Preferred Date:</span>
                                <span className="font-semibold text-gray-900">
                                  {new Date(request.preferred_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}

                            {request.preferred_time_slot && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Time Slot:</span>
                                <span className="font-semibold text-gray-900">{request.preferred_time_slot}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {request.notes && (
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <p className="text-gray-600 mb-1">Additional Notes:</p>
                            <p className="text-sm text-gray-900 bg-white p-2 rounded border border-gray-200">
                              {request.notes}
                            </p>
                          </div>
                        )}

                        {(request.furniture_photo_url || request.furniture_image_path) && (
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <p className="text-gray-600 mb-2 flex items-center gap-1.5">
                              <Image size={14} />
                              Furniture Reference
                            </p>
                            <div className="space-y-3">
                              {request.furniture_image_path && (
                                <a
                                  href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/furniture-photos/${request.furniture_image_path}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block group"
                                >
                                  <img
                                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/furniture-photos/${request.furniture_image_path}`}
                                    alt="Furniture photo you uploaded"
                                    className="h-36 w-auto rounded-lg border border-gray-300 object-cover group-hover:opacity-90 transition-opacity"
                                  />
                                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                    <ExternalLink size={11} />
                                    View full size
                                  </p>
                                </a>
                              )}
                              {request.furniture_photo_url && (
                                <a
                                  href={request.furniture_photo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 underline break-all"
                                >
                                  <Link size={13} className="flex-shrink-0" />
                                  {request.furniture_photo_url}
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span className="flex items-center">
                              <Clock size={14} className="mr-1" />
                              Submitted
                            </span>
                            <span>{new Date(request.submission_date).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        onClick={handleDownloadPDF}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        <Download size={18} />
                        Download PDF
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setRequest(null);
                        setEmail('');
                        setConfirmationCode('');
                        setError('');
                      }}
                      className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors mt-4"
                    >
                      Look Up Another Request
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-bold text-green-900 mb-3">Questions About Your Request?</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Our team is here to help! Contact us if you have any questions about your furniture assembly service.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="tel:+16154034538"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Call (615) 403-4538
                  </a>
                  <a
                    href="mailto:boxed2builtco@gmail.com"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-green-700 border border-green-600 rounded-lg font-semibold transition-colors"
                  >
                    Email Us
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default RequestLookupPage;
