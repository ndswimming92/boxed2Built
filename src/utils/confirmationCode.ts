export function generateConfirmationCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const code = `SR-${timestamp.slice(-4)}${randomPart}`;
  return code;
}

export function validateConfirmationCode(code: string): boolean {
  const pattern = /^SR-[A-Z0-9]{10}$/;
  return pattern.test(code);
}

export function formatConfirmationCode(code: string): string {
  return code.replace(/(.{3})/g, '$1 ').trim();
}
