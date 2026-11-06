import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPhoneInput, phoneDigitsOnly, validatePhoneInput } from '../../src/utils/phoneInput.ts';

test('formats progressively as digits are typed', () => {
  assert.equal(formatPhoneInput(''), '');
  assert.equal(formatPhoneInput('6'), '(6');
  assert.equal(formatPhoneInput('615'), '(615');
  assert.equal(formatPhoneInput('6154'), '(615) 4');
  assert.equal(formatPhoneInput('615403'), '(615) 403');
  assert.equal(formatPhoneInput('6154034'), '(615) 403-4');
  assert.equal(formatPhoneInput('6154034538'), '(615) 403-4538');
});

test('is stable when its own output is fed back in (typing and backspacing)', () => {
  for (const raw of ['(615) 403-4538', '(615) 403-', '(615) ', '(615']) {
    assert.equal(formatPhoneInput(formatPhoneInput(raw)), formatPhoneInput(raw));
  }
  assert.equal(formatPhoneInput('(615) 403-'), '(615) 403');
});

test('strips letters, punctuation and a leading country code', () => {
  assert.equal(formatPhoneInput('abc615-403.4538xyz'), '(615) 403-4538');
  assert.equal(formatPhoneInput('+1 (615) 403-4538'), '(615) 403-4538');
  assert.equal(formatPhoneInput('1-615-403-4538'), '(615) 403-4538');
  assert.equal(phoneDigitsOnly('+1 615 403 4538'), '6154034538');
});

test('keeps extra digits so they can be reported as too many', () => {
  assert.equal(formatPhoneInput('615403453899'), '(615) 403-453899');
  assert.equal(validatePhoneInput('615403453899', false), "That's 2 digits too many. US numbers have 10 digits.");
  assert.equal(validatePhoneInput('61540345389', false), "That's 1 digit too many. US numbers have 10 digits.");
});

test('too short is only reported once the visitor is done typing', () => {
  assert.equal(validatePhoneInput('61540', false), null);
  assert.equal(validatePhoneInput('61540', true), "That's 5 digits short. US numbers have 10 digits.");
  assert.equal(validatePhoneInput('615403453', true), "That's 1 digit short. US numbers have 10 digits.");
});

test('empty is only an error when complete', () => {
  assert.equal(validatePhoneInput('', false), null);
  assert.equal(validatePhoneInput('', true), 'Enter your mobile number.');
});

test('rejects area codes and exchanges starting with 0 or 1', () => {
  assert.match(validatePhoneInput('0154034538', false) ?? '', /area code/);
  assert.match(validatePhoneInput('6151034538', false) ?? '', /after the area code/);
  assert.match(validatePhoneInput('6150', false) ?? '', /after the area code/);
});

test('rejects a repeated single digit', () => {
  assert.match(validatePhoneInput('2222222222', true) ?? '', /real number/);
});

test('accepts a good number in any common format', () => {
  for (const raw of ['6154034538', '(615) 403-4538', '615-403-4538', '+1 615 403 4538', '1 (615) 403-4538']) {
    assert.equal(validatePhoneInput(raw, true), null, raw);
  }
});

test('keeps the cursor on the same digit after reformatting', async () => {
  const { caretAfterDigits } = await import('../../src/utils/phoneInput.ts');
  // Deleting the "4" after the area code: "(615) |403-4538" typed as "(615) 03-4538" with the cursor before the "0".
  const typed = '(615) 03-4538';
  const digitsBefore = phoneDigitsOnly(typed.slice(0, 6)).length; // 3 digits before the cursor
  const formatted = formatPhoneInput(typed);
  assert.equal(formatted, '(615) 034-538');
  assert.equal(caretAfterDigits(formatted, digitsBefore), 4); // right after the area code's last digit
  assert.equal(caretAfterDigits('(615) 403-4538', 4), 7); // right after the "4" of the exchange
  assert.equal(caretAfterDigits('(6', 1), 2);
  assert.equal(caretAfterDigits('(615) 403-4538', 0), 0);
  assert.equal(caretAfterDigits('(615) 403', 99), 9);
});
