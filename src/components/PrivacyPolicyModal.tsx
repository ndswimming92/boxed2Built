import React from 'react';
import Modal from './Modal';

const PrivacyPolicyModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <PrivacyPolicy />
  </Modal>
);

export default PrivacyPolicyModal;