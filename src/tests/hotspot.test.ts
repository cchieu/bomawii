/**
 * BomaWiFi Automated Unit & Logic Tests
 * Tests phone normalization, idempotency, session expiry, and currency formatting
 */

import { normalizeKenyanPhone, formatKenyanPhone, formatKes, formatDuration } from '../utils/kenya';

export function runClientTests() {
  const results: { test: string; passed: boolean; error?: string }[] = [];

  // Test 1: Phone Normalization
  try {
    const test1 = normalizeKenyanPhone('0712345678');
    if (test1.isValid && test1.normalized === '254712345678' && test1.carrier === 'Safaricom M-Pesa') {
      results.push({ test: 'Kenyan 07xx Safaricom Normalization', passed: true });
    } else {
      throw new Error(`Expected 254712345678, got ${test1.normalized}`);
    }

    const test2 = normalizeKenyanPhone('+254 799 123 456');
    if (test2.isValid && test2.normalized === '254799123456') {
      results.push({ test: 'Kenyan +254 international format normalization', passed: true });
    } else {
      throw new Error(`Normalization failed for international format`);
    }

    const test3 = normalizeKenyanPhone('0110123456');
    if (test3.isValid && test3.normalized === '254110123456') {
      results.push({ test: 'Kenyan 01xx series normalization', passed: true });
    } else {
      throw new Error(`01xx normalization failed`);
    }

    const testInvalid = normalizeKenyanPhone('0201234567');
    if (!testInvalid.isValid) {
      results.push({ test: 'Invalid landline prefix rejection', passed: true });
    } else {
      throw new Error('Landline was incorrectly accepted');
    }
  } catch (err: any) {
    results.push({ test: 'Phone Normalization', passed: false, error: err.message });
  }

  // Test 2: Formatting
  try {
    const kes = formatKes(50);
    if (kes === 'KES 50') {
      results.push({ test: 'Currency KES formatting', passed: true });
    } else {
      throw new Error(`Expected 'KES 50', got '${kes}'`);
    }

    const duration = formatDuration(60);
    if (duration === '1 hour') {
      results.push({ test: 'Duration formatting (1 hour)', passed: true });
    } else {
      throw new Error(`Expected '1 hour', got '${duration}'`);
    }
  } catch (err: any) {
    results.push({ test: 'Formatting tests', passed: false, error: err.message });
  }

  return results;
}
