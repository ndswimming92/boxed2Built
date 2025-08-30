import React from 'react';
import Modal from './Modal';
import TermsOfService from './sections/TermsOfService';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
}

const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ 
  isOpen, 
  onClose, 
  triggerRef 
}) => (
  <Modal 
    isOpen={isOpen} 
    onClose={onClose} 
    triggerRef={triggerRef}
    title="Terms of Service"
    description="Boxed2Built Terms of Service for furniture assembly services"
  >
    <TermsOfService />
  </Modal>
);

export default TermsOfServiceModal;