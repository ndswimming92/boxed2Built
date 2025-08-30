import React from 'react';
import Modal from './Modal';
import PrivacyPolicy from './sections/PrivacyPolicy';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ 
  isOpen, 
  onClose, 
  triggerRef 
}) => (
  <Modal 
    isOpen={isOpen} 
    onClose={onClose} 
    triggerRef={triggerRef}
    title="Privacy Policy"
    description="Boxed2Built Privacy Policy for furniture assembly services"
  >
    <PrivacyPolicy />
  </Modal>
);

export default PrivacyPolicyModal;