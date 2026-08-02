/**
 * Utility for validating and normalising phone numbers across international country codes.
 * Default selected country is Saudi Arabia (+966).
 */

export interface CountryCodeOption {
  name: string;
  code: string; // e.g. "+966"
  flag: string; // e.g. "🇸🇦"
  abbr: string; // e.g. "SA"
  example: string;
}

export const COUNTRIES: CountryCodeOption[] = [
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦', abbr: 'SA', example: '50 123 4567' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪', abbr: 'AE', example: '50 123 4567' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼', abbr: 'KW', example: '9123 4567' },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭', abbr: 'BH', example: '3912 3456' },
  { name: 'Qatar', code: '+974', flag: '🇶🇦', abbr: 'QA', example: '5512 3456' },
  { name: 'Oman', code: '+968', flag: '🇴🇲', abbr: 'OM', example: '9123 4567' },
  { name: 'Egypt', code: '+20', flag: '🇪🇬', abbr: 'EG', example: '100 123 4567' },
  { name: 'Jordan', code: '+962', flag: '🇯🇴', abbr: 'JO', example: '7 9123 4567' },
  { name: 'Lebanon', code: '+961', flag: '🇱🇧', abbr: 'LB', example: '70 123 456' },
  { name: 'United States / Canada', code: '+1', flag: '🇺🇸', abbr: 'US', example: '202 555 0123' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧', abbr: 'GB', example: '7911 123456' },
  { name: 'Turkey', code: '+90', flag: '🇹🇷', abbr: 'TR', example: '501 123 4567' },
  { name: 'India', code: '+91', flag: '🇮🇳', abbr: 'IN', example: '98123 45678' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰', abbr: 'PK', example: '300 1234567' },
  { name: 'Philippines', code: '+63', flag: '🇵🇭', abbr: 'PH', example: '917 123 4567' }
];

export function parseArabicDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, digit =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
  );
}

/**
 * Extracts country code and national digits from a full phone string or input
 */
export function parsePhoneComponents(fullPhone: string): { countryCode: string; nationalNumber: string } {
  if (!fullPhone) {
    return { countryCode: '+966', nationalNumber: '' };
  }

  const cleaned = parseArabicDigits(fullPhone).trim().replace(/[\s()-]/g, '');

  // Check if starts with a known country dial code
  for (const c of COUNTRIES) {
    if (cleaned.startsWith(c.code)) {
      return {
        countryCode: c.code,
        nationalNumber: cleaned.slice(c.code.length)
      };
    }
  }

  // Handle local Saudi formats without explicit '+'
  if (cleaned.startsWith('05')) {
    return { countryCode: '+966', nationalNumber: cleaned.slice(1) }; // 5XXXXXXXX
  }
  if (cleaned.startsWith('9665')) {
    return { countryCode: '+966', nationalNumber: cleaned.slice(3) }; // 5XXXXXXXX
  }
  if (/^5\d{8}$/.test(cleaned)) {
    return { countryCode: '+966', nationalNumber: cleaned };
  }

  // Fallback
  return { countryCode: '+966', nationalNumber: cleaned.replace(/^\+/, '') };
}

/**
 * Validates a phone number based on country code and national digits
 */
export function validatePhone(countryCode: string, nationalNumber: string | number): { isValid: boolean; error?: string } {
  const digits = parseArabicDigits(String(nationalNumber || '')).trim().replace(/[\s()-]/g, '');

  // Reject letters or emojis/symbols
  if (/[^\d]/.test(digits)) {
    return { isValid: false, error: 'Phone number must contain digits only' };
  }

  if (!digits) {
    return { isValid: false, error: 'Phone number is required' };
  }

  if (countryCode === '+966') {
    // Handle user entering 05XXXXXXXX inside national field
    let saudiDigits = digits;
    if (saudiDigits.startsWith('05')) {
      saudiDigits = saudiDigits.slice(1);
    } else if (saudiDigits.startsWith('9665')) {
      saudiDigits = saudiDigits.slice(3);
    }

    if (!saudiDigits.startsWith('5')) {
      return { isValid: false, error: 'Saudi mobile numbers must start with 5 (e.g. 501234567)' };
    }

    if (saudiDigits.length !== 9) {
      return { isValid: false, error: 'Saudi mobile number must contain exactly 9 digits (e.g. 501234567)' };
    }

    return { isValid: true };
  } else {
    if (digits.length < 6 || digits.length > 15) {
      return { isValid: false, error: 'Enter a valid phone number (6 to 15 digits)' };
    }
    return { isValid: true };
  }
}

/**
 * Normalises phone to international standard format (e.g. +966501234567)
 */
export function normalisePhone(countryCode: string, nationalNumber: string | number): string {
  if (!nationalNumber) return '';
  const digits = parseArabicDigits(String(nationalNumber)).trim().replace(/[\s()-]/g, '');

  if (countryCode === '+966') {
    let saudiDigits = digits;
    if (saudiDigits.startsWith('+966')) saudiDigits = saudiDigits.slice(4);
    if (saudiDigits.startsWith('966')) saudiDigits = saudiDigits.slice(3);
    if (saudiDigits.startsWith('05')) saudiDigits = saudiDigits.slice(1);

    if (saudiDigits.startsWith('5') && saudiDigits.length === 9) {
      return `+966${saudiDigits}`;
    }
  }

  // Remove leading zeros for other countries if present
  const cleanedNational = digits.replace(/^0+/, '');
  return `${countryCode}${cleanedNational}`;
}

// Backward compatibility helpers
export function validateSaudiPhone(value: string): boolean {
  const { countryCode, nationalNumber } = parsePhoneComponents(value);
  return validatePhone(countryCode, nationalNumber).isValid;
}

export function normaliseSaudiPhone(value: string): string {
  const { countryCode, nationalNumber } = parsePhoneComponents(value);
  return normalisePhone(countryCode, nationalNumber);
}
