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

export function isValidIccid(value: string | null | undefined): boolean {
  const normalized = normalizeIccid(value);

  if (normalized.length < MIN_ICCID_LENGTH || normalized.length > MAX_ICCID_LENGTH) {
    return false;
  }

  return passesLuhnCheck(normalized);
}
