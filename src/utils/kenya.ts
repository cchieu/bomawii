/**
 * Kenya Telecom & Financial Utility Helpers
 * Validates and formats Kenyan Phone numbers, M-Pesa codes, KES currency, and Africa/Nairobi timezone
 */

/**
 * Normalizes any Kenyan phone input into standard MSISDN (254XXXXXXXXX)
 * Supports:
 * - 0712345678 -> 254712345678
 * - 0112345678 -> 254112345678
 * - +254712345678 -> 254712345678
 * - 254712345678 -> 254712345678
 * - 712345678 -> 254712345678
 */
export function normalizeKenyanPhone(input: string): { isValid: boolean; normalized: string; error?: string; carrier?: string } {
  if (!input) {
    return { isValid: false, normalized: '', error: 'Phone number is required' };
  }

  // Remove spaces, hyphens, parentheses, plus
  let cleaned = input.replace(/[\s\-\(\)\+]/g, '');

  // Handle leading 0 (e.g. 0712345678 or 0112345678)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '254' + cleaned.substring(1);
  }
  // Handle 9 digit (e.g. 712345678 or 112345678)
  else if ((cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) {
    cleaned = '254' + cleaned;
  }
  // Handle 254 prefix without plus
  else if (cleaned.startsWith('254') && cleaned.length === 12) {
    // Already in 254 format
  } else {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'Invalid phone format. Enter a 10-digit number (e.g., 0712345678 or 0112345678)',
    };
  }

  // Must be 12 digits starting with 2547 or 2541
  const msisdnRegex = /^254(7\d{8}|1\d{8})$/;
  if (!msisdnRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'Phone must be a valid Kenyan mobile number starting with 07... or 01...',
    };
  }

  // Detect Carrier
  let carrier = 'Kenyan Network';
  const prefix = cleaned.substring(3, 5); // 70, 71, 72, 11, etc.
  const prefix3 = cleaned.substring(3, 6);

  // Safaricom prefixes: 0700-0729, 0740-0743, 0745, 0746, 0748, 0790-0799, 0110-0115
  if (
    ['70', '71', '72', '79'].includes(prefix) ||
    ['740', '741', '742', '743', '745', '746', '748', '110', '111', '112', '113', '114', '115'].includes(prefix3)
  ) {
    carrier = 'Safaricom M-Pesa';
  } else if (['73', '75', '78'].includes(prefix) || ['100', '101', '102'].includes(prefix3)) {
    carrier = 'Airtel Money';
  } else if (['77'].includes(prefix)) {
    carrier = 'Telkom T-Kash';
  }

  return {
    isValid: true,
    normalized: cleaned,
    carrier,
  };
}

/**
 * Pretty prints phone number: e.g. +254 712 345 678 or 0712 345 678
 */
export function formatKenyanPhone(phone: string, style: 'local' | 'international' = 'local'): string {
  const norm = normalizeKenyanPhone(phone);
  if (!norm.isValid) return phone;
  const num = norm.normalized; // 254 712 345 678
  const p1 = num.substring(3, 6);
  const p2 = num.substring(6, 9);
  const p3 = num.substring(9, 12);

  if (style === 'international') {
    return `+254 ${num.substring(3, 5)} ${p2} ${p3}`;
  }
  return `0${num.substring(3, 5)}${p1.substring(2)} ${p2} ${p3}`;
}

/**
 * Format currency in Kenyan Shillings
 */
export function formatKes(amount: number): string {
  return `KES ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Format date in Africa/Nairobi timezone (EAT - UTC+3)
 */
export function formatNairobiDateTime(isoString: string | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date) + ' EAT';
  } catch {
    return isoString;
  }
}

/**
 * Format human duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} mins`;
  }
  const hours = minutes / 60;
  if (hours === 1) return '1 hour';
  if (hours < 24) {
    return `${Number(hours.toFixed(1)).toString()} hours`;
  }
  const days = hours / 24;
  if (days === 1) return '24 hours (1 day)';
  return `${Number(days.toFixed(1)).toString()} days`;
}

/**
 * Format bytes into KB, MB, GB
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
