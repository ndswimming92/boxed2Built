import React from 'react';
import Modal from './Modal';

const TermsOfServiceModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last Updated: June 2, 2025</p>
      <ol className="list-decimal pl-6 space-y-4 text-gray-800 text-sm leading-relaxed">
        <li><strong>Services Provided:</strong> Boxed2Built offers furniture assembly services in Spring Hill, TN and surrounding areas...</li>
        <li><strong>Booking & Payments:</strong> All service bookings must be made through our official channels...</li>
        <li><strong>Cancellations & Rescheduling:</strong> Clients may cancel or reschedule up to 24 hours...</li>
        <li><strong>Client Responsibilities:</strong> Ensure a clear, safe workspace...</li>
        <li><strong>Service Limitations:</strong> We reserve the right to refuse service if...</li>
        <li><strong>Third-Party Products Disclaimer:</strong> We assemble third-party furniture...</li>
        <li><strong>Liability Disclaimer:</strong> Boxed2Built is not liable for...</li>
        <li><strong>Damage and Insurance Disclaimer:</strong> Clients must inform us...</li>
        <li><strong>Satisfaction Policy:</strong> We strive for 100% satisfaction...</li>
        <li><strong>Website Use & User Conduct:</strong> You may not use our site for unlawful purposes...</li>
        <li><strong>Intellectual Property:</strong> All website content is the property of Boxed2Built...</li>
        <li><strong>Changes to Terms:</strong> We may update these Terms...</li>
        <li><strong>Governing Law & Dispute Resolution:</strong> These Terms are governed by Tennessee law...</li>
        <li><strong>Contact Us:</strong> 📧 boxed2builtco@gmail.com | 📞 615-403-4538</li>
      </ol>
    </div>
  </Modal>
);

export default TermsOfServiceModal;