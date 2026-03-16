import React, { useEffect, useMemo } from 'react';

export interface FAQ {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQ[];
  /** Optional: cap how many FAQs we include in schema */
  maxItems?: number;
}

/** Basic HTML tag stripper to keep JSON-LD "text" clean */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ') // remove tags
    .replace(/\s+/g, ' ')     // collapse whitespace
    .trim();
}

function normalize(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

const FAQSchema: React.FC<FAQSchemaProps> = ({ faqs, maxItems = 50 }) => {
  const schemaData = useMemo(() => {
    if (!faqs || faqs.length === 0) return null;

    // Normalize + dedupe by question text
    const seen = new Set<string>();
    const cleaned = faqs
      .map((f) => ({
        question: normalize(stripHtml(f.question)),
        answer: normalize(stripHtml(f.answer)),
      }))
      .filter((f) => f.question.length > 0 && f.answer.length > 0)
      .filter((f) => {
        const key = f.question.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxItems);

    if (cleaned.length === 0) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: cleaned.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }, [faqs, maxItems]);

  useEffect(() => {
    const schemaId = 'faq-schema-jsonld';
    const existing = document.getElementById(schemaId);

    if (!schemaData) {
      existing?.remove();
      return;
    }

    const script = existing || document.createElement('script');
    script.id = schemaId;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(schemaData);

    if (!existing) {
      document.head.appendChild(script);
    }

    return () => {
      const current = document.getElementById(schemaId);
      if (current && current.textContent === JSON.stringify(schemaData)) {
        current.remove();
      }
    };
  }, [schemaData]);

  return null;
};

export default FAQSchema;
