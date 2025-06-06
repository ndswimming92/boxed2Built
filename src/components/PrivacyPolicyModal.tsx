import React from 'react';
import Modal from './Modal';
import PrivacyPolicy from './sections/PrivacyPolicy';

const PrivacyPolicyModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <PrivacyPolicy />
  </Modal>
);

export default PrivacyPolicyModal;