import React from 'react';
import Modal from './Modal';
import TermsOfService from './sections/TermsOfService';

const TermsOfServiceModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <TermsOfService />
  </Modal>
);

export default TermsOfServiceModal;