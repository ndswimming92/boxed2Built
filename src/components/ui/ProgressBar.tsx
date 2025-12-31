import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = '' }) => {
  const getMotivationalText = () => {
    if (progress === 0) return 'Get started';
    if (progress < 25) return 'Just getting started...';
    if (progress < 50) return 'Making progress...';
    if (progress < 75) return 'Over halfway there!';
    if (progress < 100) return 'Almost there!';
    return 'Ready to submit!';
  };

  const getBarColor = () => {
    if (progress === 0) return 'bg-gray-300';
    if (progress < 100) return 'bg-blue-600';
    return 'bg-green-600';
  };

  const getTextColor = () => {
    if (progress === 0) return 'text-gray-600';
    if (progress < 100) return 'text-blue-700';
    return 'text-green-700';
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${getTextColor()}`}>
          {getMotivationalText()}
        </span>
        <div className="flex items-center gap-1">
          {progress === 100 && (
            <CheckCircle size={16} className="text-green-600" />
          )}
          <span className={`text-sm font-bold ${getTextColor()}`}>
            {progress}%
          </span>
        </div>
      </div>

      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Form completion: ${progress}%`}
        >
          {progress > 0 && progress < 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
