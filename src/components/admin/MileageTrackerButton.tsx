import { useState, useEffect } from 'react';
import { Navigation, Square, AlertCircle, MapPin } from 'lucide-react';
import { mileageTracker } from '../../services/mileageTrackingService';
import type { Job } from '../../lib/supabase';

interface MileageTrackerButtonProps {
  job: Job;
  businessId: string;
  onTrackingComplete?: () => void;
}

export default function MileageTrackerButton({ job, businessId, onTrackingComplete }: MileageTrackerButtonProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isTracking) {
      interval = setInterval(() => {
        const state = mileageTracker.getTrackingState();
        setCurrentDistance(state.currentDistance);

        if (state.startTime) {
          const elapsed = Math.floor((Date.now() - state.startTime.getTime()) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);

  const handleStartTracking = async () => {
    setError(null);
    const result = await mileageTracker.startTracking();

    if (result.success) {
      setIsTracking(true);
    } else {
      setError(result.error || 'Failed to start tracking');
    }
  };

  const handleStopTracking = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const trackingData = await mileageTracker.stopTracking();
      setIsTracking(false);

      if (trackingData.currentDistance < 0.1) {
        setError('Trip too short to record. Minimum distance is 0.1 miles.');
        setIsSaving(false);
        return;
      }

      const irsRate = await mileageTracker.getCurrentMileageRate(businessId);

      const result = await mileageTracker.saveMileageRecord(
        businessId,
        job.id,
        trackingData,
        irsRate,
        `Trip for ${job.client_name} - ${job.job_type || 'Job'}`
      );

      if (result.success) {
        setCurrentDistance(0);
        setElapsedTime(0);
        if (onTrackingComplete) {
          onTrackingComplete();
        }
      } else {
        setError(result.error || 'Failed to save mileage record');
      }
    } catch (err) {
      console.error('Error stopping tracking:', err);
      setError('Failed to save trip data');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (isTracking) {
    return (
      <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-blue-900">Tracking Active</span>
          </div>
          <MapPin className="w-5 h-5 text-blue-600" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-600 mb-1">Distance</div>
            <div className="text-2xl font-bold text-blue-900">
              {currentDistance.toFixed(2)}
              <span className="text-sm ml-1">mi</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Time</div>
            <div className="text-2xl font-bold text-blue-900">{formatTime(elapsedTime)}</div>
          </div>
        </div>

        <button
          onClick={handleStopTracking}
          disabled={isSaving}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
        >
          <Square className="w-5 h-5" />
          <span>{isSaving ? 'Saving...' : 'Stop Tracking'}</span>
        </button>

        {error && (
          <div className="mt-3 flex items-start space-x-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleStartTracking}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
      >
        <Navigation className="w-5 h-5" />
        <span>Start Mileage Tracking</span>
      </button>

      {error && (
        <div className="mt-3 flex items-start space-x-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
