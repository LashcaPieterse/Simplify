const MIN_ICCID_LENGTH = 18;
const MAX_ICCID_LENGTH = 22;

export function normalizeIccid(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(/[^0-9]/g, "");
}

function passesLuhnCheck(value: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let i = value.length - 1; i >= 0; i--) {
    let digit = Number(value[i]);
    if (Number.isNaN(digit)) {
      return false;
    }

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function hasValidLength(value: string): boolean {
  return value.length >= MIN_ICCID_LENGTH && value.length <= MAX_ICCID_LENGTH;
}

/**
 * ICCID values from upstream providers are sometimes operationally valid while
 * not passing a strict Luhn checksum. We therefore use a lenient validation
 * gate for UI/API flow control and avoid blocking instruction/QR lookups.
 */
export function isValidIccid(value: string | null | undefined): boolean {
  const normalized = normalizeIccid(value);

  return hasValidLength(normalized);
}

export function isStrictlyValidIccid(
  value: string | null | undefined,
): boolean {
  const normalized = normalizeIccid(value);

  if (!hasValidLength(normalized)) {
    return false;
  }

  return passesLuhnCheck(normalized);
}
