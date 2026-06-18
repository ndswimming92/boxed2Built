import React from 'react';
import { CheckCircle } from 'lucide-react';

interface FormProgressRailProps {
  /** Completion percentage (0-100). */
  progress: number;
}

/**
 * Vertical progress meter that spans the full height of the quote form on large
 * screens, sitting just outside its left edge. Rendered as an absolutely
 * positioned child of a `relative` wrapper around the form card, so it starts at
 * the top of the form, ends at the bottom, and scrolls with it. Hidden below lg.
 */
const FormProgressRail: React.FC<FormProgressRailProps> = ({ progress }) => {
  const isComplete = progress >= 100;
  const barColor = progress === 0 ? 'bg-gray-300' : isComplete ? 'bg-green-600' : 'bg-blue-600';
  const textColor = progress === 0 ? 'text-gray-500' : isComplete ? 'text-green-700' : 'text-blue-700';

  const motivationalText = (() => {
    if (progress === 0) return 'Get started';
    if (progress < 25) return 'Just getting started';
    if (progress < 50) return 'Making progress';
    if (progress < 75) return 'Over halfway there';
    if (progress < 100) return 'Almost there';
    return 'Ready to submit!';
  })();

  return (
    <div
      className="hidden lg:flex absolute top-0 bottom-0 right-full mr-6 w-14 flex-col items-center"
      role="progressbar"
      aria-label={`Form completion: ${progress}%`}
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={`mb-3 text-sm font-bold ${textColor}`}>{progress}%</span>

      {/* Track stretches to fill the form's height; fill grows top-down with progress */}
      <div className="relative flex-1 w-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 w-full ${barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ height: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex flex-col items-center text-center">
        {isComplete && <CheckCircle size={18} className="text-green-600 mb-1" />}
        <span className={`text-[11px] font-medium leading-tight ${textColor}`}>{motivationalText}</span>
      </div>
    </div>
  );
};

export default FormProgressRail;
