import React, { useState, useRef } from 'react';
import { Crop, RotateCcw } from 'lucide-react';

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
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const getRelativePosition = (clientX: number, clientY: number) => {
    if (!imageRef.current) return null;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getRelativePosition(e.clientX, e.clientY);
    if (!pos) return;

    setIsSelecting(true);
    setStartPos(pos);
    setSelectionBox({
      left: pos.x,
      top: pos.y,
      width: 0,
      height: 0
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !startPos || !imageRef.current) return;

    const pos = getRelativePosition(e.clientX, e.clientY);
    if (!pos) return;

    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;

    setSelectionBox({
      left: width < 0 ? pos.x : startPos.x,
      top: height < 0 ? pos.y : startPos.y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = () => {
    if (selectionBox && selectionBox.width > 0 && selectionBox.height > 0) {
      // Calculate center of selection box as the focus point
      const centerX = selectionBox.left + (selectionBox.width / 2);
      const centerY = selectionBox.top + (selectionBox.height / 2);

      setFocusX(centerX);
      setFocusY(centerY);
      onFocusChange(centerX, centerY);
    }
    setIsSelecting(false);
    setStartPos(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    // If it was just a click (not a drag), set focus point directly
    if (!isSelecting) {
      const pos = getRelativePosition(e.clientX, e.clientY);
      if (!pos) return;

      setFocusX(pos.x);
      setFocusY(pos.y);
      onFocusChange(pos.x, pos.y);
      setSelectionBox(null);
    }
  };

  const handleReset = () => {
    setFocusX(50);
    setFocusY(50);
    onFocusChange(50, 50);
    setSelectionBox(null);
  };

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crop size={16} className="text-slate-600" />
          <div>
            <label className="text-sm font-medium text-slate-700 block">
              Focus Area Selection
            </label>
            <span className="text-xs text-slate-500">
              Click to set a focus point, or click and drag to select an area
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-xs font-medium transition-colors"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative w-full bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-300 hover:border-emerald-500 transition-colors"
        style={{ minHeight: '400px' }}
      >
        <div
          className="relative w-full h-full flex items-center justify-center cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Focus area selector"
            className="max-w-full max-h-[500px] object-contain select-none"
            draggable={false}
          />

          {/* Current focus point indicator */}
          <div
            className="absolute w-6 h-6 -ml-3 -mt-3 pointer-events-none z-20"
            style={{
              left: `${focusX}%`,
              top: `${focusY}%`,
            }}
          >
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-emerald-500 rounded-full opacity-40 animate-pulse"></div>
              <div className="absolute inset-0 border-2 border-emerald-500 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-0.5 h-full bg-white"></div>
                <div className="w-full h-0.5 bg-white absolute"></div>
              </div>
            </div>
          </div>

          {/* Selection box overlay */}
          {selectionBox && selectionBox.width > 0 && selectionBox.height > 0 && (
            <>
              {/* Darkened areas outside selection */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <svg className="w-full h-full" style={{ position: 'absolute' }}>
                  <defs>
                    <mask id="selection-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect
                        x={`${selectionBox.left}%`}
                        y={`${selectionBox.top}%`}
                        width={`${selectionBox.width}%`}
                        height={`${selectionBox.height}%`}
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.5)"
                    mask="url(#selection-mask)"
                  />
                </svg>
              </div>

              {/* Selection box border */}
              <div
                className="absolute border-2 border-emerald-500 pointer-events-none z-10"
                style={{
                  left: `${selectionBox.left}%`,
                  top: `${selectionBox.top}%`,
                  width: `${selectionBox.width}%`,
                  height: `${selectionBox.height}%`,
                }}
              >
                <div className="absolute inset-0 bg-emerald-500 opacity-10"></div>
                {/* Corner handles */}
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-emerald-500 rounded-full"></div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full"></div>
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-emerald-500 rounded-full"></div>
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full"></div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-xs font-medium text-slate-600 mb-1">Focus Point</div>
          <div className="text-sm font-semibold text-slate-900">
            X: {focusX.toFixed(1)}%, Y: {focusY.toFixed(1)}%
          </div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
          <div className="text-xs font-medium text-emerald-700 mb-1">Status</div>
          <div className="text-sm font-semibold text-emerald-900">
            {selectionBox && selectionBox.width > 0 ? 'Area Selected' : 'Point Selected'}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded p-2">
        <strong>Tip:</strong> The selected area/point will be prioritized when your image is displayed.
        Drag to select a region, or click to set a focus point.
      </div>
    </div>
  );
}
