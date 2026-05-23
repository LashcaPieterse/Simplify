export function formatCurrency(amountCents: number, currency = "USD") {
  try {
    const hasCents = amountCents % 100 !== 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export function formatNullableCurrency(
  amountCents: number | null | undefined,
  currency?: string | null,
  fallback = "—",
) {
  if (amountCents === null || amountCents === undefined || Number.isNaN(amountCents)) {
    return fallback;
  }

  return formatCurrency(amountCents, currency ?? "USD");
}

export function formatMoneyAmount(
  amount: number | null | undefined,
  currency = "USD",
  fallback = "",
) {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return fallback;
  }

  try {
    const hasCents = amount % 1 !== 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount}`;
  }
}

export function centsToMajorUnits(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function percentageChange(newValue: number, oldValue: number) {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
}
