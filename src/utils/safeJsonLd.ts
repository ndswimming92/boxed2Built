/**
 * Serialises structured data for a `<script type="application/ld+json">` body.
 *
 * Plain JSON.stringify leaves `<` alone, so a string containing `</script>`
 * (a review, a business name edited in the admin) would close the tag and let
 * the rest run as HTML. Escaping `<` and the two JS line separators keeps the
 * output valid JSON with the same meaning.
 */
export function safeJsonLd(data: unknown, space?: number): string {
  return JSON.stringify(data, null, space)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
