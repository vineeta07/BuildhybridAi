import { describe, expect, it } from 'vitest';
import { describeRedactions, hasPersonalData, luhn, redact } from '../src/redact';

describe('redaction', () => {
  it('email', () => {
    expect(redact('mail me at ravi.k@example.com now')).toEqual({ text: 'mail me at [EMAIL_1] now', counts: { EMAIL: 1 } });
  });
  it('Indian mobile with and without prefix', () => {
    expect(redact('call 9876543210').text).toBe('call [PHONE_1]');
    expect(redact('call +91 9876543210').text).toBe('call [PHONE_1]');
    expect(redact('call 09876543210').text).toBe('call [PHONE_1]');
    expect(redact('number 5876543210').counts.PHONE).toBeUndefined(); // must start 6-9
  });
  it('a 10-digit mobile is a phone, not an account', () => {
    expect(redact('account holder phone 9876543210').counts).toEqual({ PHONE: 1 });
  });
  it('Aadhaar with spaces, hyphens or none', () => {
    expect(redact('Aadhaar 2345 6789 0123').text).toBe('Aadhaar [AADHAAR_1]');
    expect(redact('Aadhaar 2345-6789-0123').text).toBe('Aadhaar [AADHAAR_1]');
    expect(redact('Aadhaar 234567890123').text).toBe('Aadhaar [AADHAAR_1]');
    expect(redact('id 1345 6789 0123').counts.AADHAAR).toBeUndefined(); // first digit 2-9
  });
  it('PAN', () => {
    expect(redact('PAN ABCDE1234F').text).toBe('PAN [PAN_1]');
    expect(redact('code abcde1234f').counts.PAN).toBeUndefined();
  });
  it('card numbers need a valid Luhn', () => {
    expect(redact('card 4111 1111 1111 1111').text).toBe('card [CARD_1]');
    expect(redact('card 4111-1111-1111-1111').text).toBe('card [CARD_1]');
    const bad = redact('ref 4111111111111112 end');
    expect(bad.counts.CARD).toBeUndefined();
    expect(redact('order 1234567890123').counts.CARD).toBeUndefined(); // 13 digits, fails Luhn
    expect(luhn('4111111111111111')).toBe(true);
  });
  it('UPI ID (after email)', () => {
    expect(redact('pay to ravi.k@okaxis today').text).toBe('pay to [UPI_1] today');
    expect(redact('pay ravi@oksbi.').text).toBe('pay [UPI_1].');
    expect(redact('write a@b.com').counts).toEqual({ EMAIL: 1 });
  });
  it('IFSC', () => {
    expect(redact('IFSC SBIN0001234').text).toBe('IFSC [IFSC_1]');
  });
  it('account number near the word account', () => {
    expect(redact('Account No: 123456789012345').text).toBe('Account No: [ACCOUNT_1]');
    expect(redact('a/c 00112233445').text).toBe('a/c [ACCOUNT_1]');
    expect(redact('order 123456789012345 shipped').counts.ACCOUNT).toBeUndefined();
  });
  it('OTP, PIN, CVV codes', () => {
    expect(redact('Your OTP is 482913').text).toBe('Your OTP is [CODE_1]');
    expect(redact('CVV: 123').text).toBe('CVV: [CODE_1]');
    expect(redact('pincode 110001').counts.CODE).toBeUndefined();
  });
  it('US SSN', () => {
    expect(redact('SSN 123-45-6789').text).toBe('SSN [SSN_1]');
  });
  it('does not touch dates, prices or short numbers', () => {
    const t = 'On 12/05/2025 and 2025-11-22 pay Rs 4,999 by 10:30 for 3 items.';
    expect(redact(t)).toEqual({ text: t, counts: {} });
    expect(hasPersonalData(t)).toBe(false);
  });
  it('counts by type and numbers placeholders', () => {
    const r = redact('9876543210 and 9123456789, card 4111 1111 1111 1111');
    expect(r.counts).toEqual({ CARD: 1, PHONE: 2 });
    expect(r.text).toContain('[PHONE_2]');
    expect(describeRedactions(r.counts)).toBe('1 card number, 2 phone numbers');
  });
});
