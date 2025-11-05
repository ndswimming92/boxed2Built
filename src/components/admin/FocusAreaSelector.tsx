import React, { useState, useRef, useEffect } from 'react';
import { Crosshair } from 'lucide-react';

interface FocusAreaSelectorProps {
  imageUrl: string;
  initialFocusX?: number;
  initialFocusY?: number;
  onFocusChange: (x: number, y: number) => void;
  className?: string;
}

export default function FocusAreaSelector({
  imageUrl,
  initialFocusX = 50,
  initialFocusY = 50,
  onFocusChange,
  className = ''
}: FocusAreaSelectorProps) {
  const [focusX, setFocusX] = useState(initialFocusX);
  const [focusY, setFocusY] = useState(initialFocusY);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusX(initialFocusX);
    setFocusY(initialFocusY);
  }, [initialFocusX, initialFocusY]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateFocusPosition(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateFocusPosition(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateFocusPositionTouch(e);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateFocusPositionTouch(e);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const updateFocusPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    setFocusX(clampedX);
    setFocusY(clampedY);
    onFocusChange(clampedX, clampedY);
  };

  const updateFocusPositionTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || !e.touches[0]) return;

    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    setFocusX(clampedX);
    setFocusY(clampedY);
    onFocusChange(clampedX, clampedY);
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <Crosshair size={16} className="text-slate-600" />
        <label className="text-sm font-medium text-slate-700">
          Focus Area
        </label>
        <span className="text-xs text-slate-500">
          (Click or drag to set focus point)
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-slate-100 rounded-lg overflow-hidden cursor-crosshair border-2 border-slate-300 hover:border-emerald-500 transition-colors"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={imageUrl}
          alt="Focus area selector"
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
        />

        <div
          className="absolute w-8 h-8 -ml-4 -mt-4 pointer-events-none transition-all"
          style={{
            left: `${focusX}%`,
            top: `${focusY}%`,
          }}
        >
          <div className="relative w-full h-full">
            <div className="absolute inset-0 bg-emerald-500 rounded-full opacity-30"></div>
            <div className="absolute inset-0 border-2 border-emerald-500 rounded-full"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-0.5 h-full bg-emerald-500"></div>
              <div className="w-full h-0.5 bg-emerald-500 absolute"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <span>X: {focusX.toFixed(1)}%</span>
        <button
          type="button"
          onClick={() => {
            setFocusX(50);
            setFocusY(50);
            onFocusChange(50, 50);
          }}
          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-colors"
        >
          Reset to Center
        </button>
        <span>Y: {focusY.toFixed(1)}%</span>
      </div>
    </div>
  );
}
