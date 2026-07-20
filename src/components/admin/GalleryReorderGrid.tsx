import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Image as ImageIcon, Video, Check, X } from 'lucide-react';
import { GalleryService } from '../../services/galleryService';
import type { GalleryItem } from '../../services/galleryService';
import Button from '../ui/Button';

interface GalleryReorderGridProps {
  items: GalleryItem[];
  onDone: () => void;
}

function SortableCard({ item, position }: { item: GalleryItem; position: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative bg-white rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? 'border-emerald-500 shadow-lg' : item.is_active ? 'border-slate-200' : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black bg-opacity-60 text-white rounded px-1.5 py-1">
        <GripVertical size={14} />
        <span className="text-xs font-semibold">{position}</span>
      </div>

      <div className="relative aspect-square bg-slate-100">
        {item.type === 'image' ? (
          <img
            src={item.src}
            alt={item.title}
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-900">
            <Video size={40} className="text-white" />
          </div>
        )}
        {!item.is_active && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-medium">
              Inactive
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2">
          {item.type === 'image' ? (
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
              <ImageIcon size={12} className="inline mr-1" />
              Image
            </span>
          ) : (
            <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium">
              <Video size={12} className="inline mr-1" />
              Video
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">{item.title}</h3>
        <p className="text-xs text-slate-500 mt-1 capitalize">{item.category.replace('-', ' ')}</p>
      </div>
    </div>
  );
}

export default function GalleryReorderGrid({ items, onDone }: GalleryReorderGridProps) {
  const [order, setOrder] = useState<GalleryItem[]>(items);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrder((current) => {
      const oldIndex = current.findIndex((i) => i.id === active.id);
      const newIndex = current.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      await GalleryService.updateDisplayOrder(
        order.map((item, index) => ({ id: item.id, display_order: index }))
      );
      onDone();
    } catch (err) {
      console.error('Error saving gallery order:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save the new order');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (dirty && !window.confirm('Discard your reordering changes?')) return;
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <p className="text-sm text-emerald-800">
          <span className="font-semibold">Reorder mode.</span> Drag the tiles to set the order customers
          see on the public gallery. This affects the &ldquo;All Work&rdquo; view and the relative order within
          each category tab.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={handleCancel} variant="outline" disabled={saving}>
            <X size={16} className="mr-1.5" />
            Cancel
          </Button>
          <Button onClick={handleSave} variant="primary" disabled={saving || !dirty}>
            <Check size={16} className="mr-1.5" />
            {saving ? 'Saving...' : 'Save Order'}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {order.map((item, index) => (
              <SortableCard key={item.id} item={item} position={index + 1} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
