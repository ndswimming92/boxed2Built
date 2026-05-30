import React, { useMemo } from 'react';

export interface FAQ {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQ[];
  /** Optional: cap how many FAQs we include in schema */
  maxItems?: number;
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

const FAQSchema: React.FC<FAQSchemaProps> = ({ faqs, maxItems = 50 }) => {
  const schemaData = useMemo(() => {
    if (!faqs || faqs.length === 0) return null;

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

  if (!schemaData) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};

export default FAQSchema;
