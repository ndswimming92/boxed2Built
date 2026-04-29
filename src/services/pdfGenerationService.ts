export interface RequestSummaryData {
  confirmationCode: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  furnitureType: string;
  pieces: number;
  preferredDate?: string;
  preferredTimeSlot?: string;
  notes?: string;
  userCity?: string;
  estimatedPrice?: string;
  estimatedTime?: string;
  submissionDate: string;
}

export async function generateRequestSummaryPDF(data: RequestSummaryData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Boxed2Built', margin, yPosition);

  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Professional Furniture Assembly Service', margin, yPosition);

  yPosition += 15;
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);

  yPosition += 12;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Service Request Confirmation', margin, yPosition);

  yPosition += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Submitted: ${new Date(data.submissionDate).toLocaleString()}`, margin, yPosition);

  yPosition += 15;
  doc.setFillColor(239, 246, 255);
  doc.rect(margin, yPosition - 8, pageWidth - 2 * margin, 20, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('Confirmation Code:', margin + 5, yPosition);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.confirmationCode, margin + 5, yPosition + 8);

  yPosition += 25;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Contact Information', margin, yPosition);

  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text('Name:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName, margin + 50, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Email:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientEmail, margin + 50, yPosition);

  if (data.clientPhone) {
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.clientPhone, margin + 50, yPosition);
  }

  if (data.userCity) {
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Location:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.userCity, margin + 50, yPosition);
  }

  yPosition += 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Details', margin, yPosition);

  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Furniture Type:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.furnitureType, margin + 50, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Number of Pieces:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.pieces.toString(), margin + 50, yPosition);

  if (data.estimatedPrice) {
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Estimated Cost:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.estimatedPrice, margin + 50, yPosition);
  }

  if (data.estimatedTime) {
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Estimated Time:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.estimatedTime, margin + 50, yPosition);
  }

  if (data.preferredDate || data.preferredTimeSlot) {
    yPosition += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Scheduling Preferences', margin, yPosition);

    yPosition += 8;
    doc.setFontSize(10);

    if (data.preferredDate) {
      doc.setFont('helvetica', 'bold');
      doc.text('Preferred Date:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(data.preferredDate).toLocaleDateString(), margin + 50, yPosition);
      yPosition += 6;
    }

    if (data.preferredTimeSlot) {
      doc.setFont('helvetica', 'bold');
      doc.text('Time Slot:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(data.preferredTimeSlot, margin + 50, yPosition);
    }
  }

  if (data.notes) {
    yPosition += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Additional Notes', margin, yPosition);

    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
    doc.text(splitNotes, margin, yPosition);
    yPosition += splitNotes.length * 5;
  }

  yPosition += 15;
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 35, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74);
  doc.text('What Happens Next?', margin + 5, yPosition);

  yPosition += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('1. We will review your project details within 24 hours', margin + 5, yPosition);

  yPosition += 5;
  doc.text('2. You will receive a detailed quote via email', margin + 5, yPosition);

  yPosition += 5;
  doc.text('3. Once approved, we will schedule your assembly service', margin + 5, yPosition);

  yPosition += 5;
  doc.text('4. Our professional team will complete your assembly on time', margin + 5, yPosition);

  yPosition += 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Contact Us', margin, yPosition);

  yPosition += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Phone: (615) 551-1402', margin, yPosition);

  yPosition += 5;
  doc.text('Email: boxed2builtco@gmail.com', margin, yPosition);

  yPosition += 5;
  doc.text('Website: https://boxed2built.com', margin, yPosition);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.text('Boxed2Built - Professional Furniture Assembly Service', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Serving Spring Hill, Columbia, Franklin & Surrounding Areas', pageWidth / 2, footerY + 4, { align: 'center' });

  const filename = `Boxed2Built-Request-${data.confirmationCode}.pdf`;
  doc.save(filename);
}
