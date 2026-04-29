import { FormInquiry } from '../lib/supabase';

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES = {
  quote_followup: (inquiry: FormInquiry): EmailTemplate => ({
    subject: `Your Furniture Assembly Quote - ${inquiry.furniture_type}`,
    body: `Hi ${inquiry.client_name},

Thank you for your interest in our furniture assembly services!

Based on your request for ${inquiry.pieces} ${inquiry.furniture_type}, we'd like to provide you with a detailed quote and discuss your project.

Project Details:
- Furniture Type: ${inquiry.furniture_type}
- Number of Pieces: ${inquiry.pieces}
- Estimated Time: ${inquiry.estimated_time || 'TBD'}
- Estimated Cost: ${inquiry.estimated_price || 'TBD'}
${inquiry.preferred_date ? `- Preferred Date: ${inquiry.preferred_date}` : ''}
${inquiry.preferred_time_slot ? `- Preferred Time: ${inquiry.preferred_time_slot}` : ''}

We'd love to schedule a free consultation to discuss your project in more detail and provide an accurate quote.

Would you be available for a quick call at your convenience?

Best regards,
Boxed2Built
(615) 551-1402
boxed2builtco@gmail.com`,
  }),

  request_more_info: (inquiry: FormInquiry): EmailTemplate => ({
    subject: 'Quick Question About Your Furniture Assembly Request',
    body: `Hi ${inquiry.client_name},

Thanks for reaching out about furniture assembly!

I'd like to get a bit more information about your ${inquiry.furniture_type} project to provide you with the most accurate quote possible.

Could you share:
- Brand and model (if known)
- Any special requirements or concerns
- Best time to reach you for a quick discussion

We're here to make your furniture assembly as smooth as possible!

Best regards,
Boxed2Built
(615) 551-1402
boxed2builtco@gmail.com`,
  }),

  schedule_consultation: (inquiry: FormInquiry): EmailTemplate => ({
    subject: 'Let\'s Schedule Your Free Furniture Assembly Consultation',
    body: `Hi ${inquiry.client_name},

Thank you for your interest in our furniture assembly services for your ${inquiry.furniture_type}!

I'd like to schedule a free consultation to discuss your project and provide you with a detailed quote.

${inquiry.preferred_date && inquiry.preferred_time_slot
  ? `I see you mentioned preferring ${inquiry.preferred_date} during ${inquiry.preferred_time_slot}. Does that time still work for you?`
  : 'What day and time works best for you?'}

You can also book directly online at: https://boxed2built.com/contact

Or give us a call at (615) 403-4538.

Looking forward to helping you with your project!

Best regards,
Boxed2Built`,
  }),

  custom: (): EmailTemplate => ({
    subject: '',
    body: '',
  }),
};

export function openEmailClient(to: string, subject: string, body: string): void {
  const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoLink;
}

export function formatPhoneForDisplay(phone: string | null): string {
  if (!phone) return '';

  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1');
}
