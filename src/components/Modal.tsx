import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  triggerRef?: React.RefObject<HTMLElement>;
  title?: string;
  description?: string;
  size?: 'small' | 'medium' | 'large';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  triggerRef,
  title,
  description,
  size = 'medium'
}) => {
  const sizeClasses: Record<'small' | 'medium' | 'large', string> = {
    small: 'max-w-md',
    medium: 'max-w-3xl',
    large: 'max-w-5xl',
  };
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal content when it opens
    if (modalRef.current) {
      modalRef.current.focus();
    }

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Handle focus trap
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTabKey);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTabKey);
      document.body.style.overflow = 'unset';

      // Restore focus to the trigger element or previously focused element
      const elementToFocus = triggerRef?.current || previousActiveElement.current;
      if (elementToFocus) {
        elementToFocus.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      role="presentation"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        ref={modalRef}
        className={`bg-white rounded-t-lg sm:rounded-lg ${sizeClasses[size]} w-full p-6 relative overflow-y-auto max-h-dvh sm:max-h-[90vh] shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close modal"
        >
          &times;
        </button>

        {title && (
          <h2 id="modal-title" className="sr-only">{title}</h2>
        )}
        {description && (
          <p id="modal-description" className="sr-only">{description}</p>
        )}

        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;