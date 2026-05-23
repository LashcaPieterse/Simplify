export const DEFAULT_QUANTITY = 1;
export const MAX_QUANTITY = 10;

export function normaliseQuantity(quantity?: number): number {
  if (typeof quantity !== "number" || Number.isNaN(quantity)) {
    return DEFAULT_QUANTITY;
  }

  return Math.min(Math.max(quantity, DEFAULT_QUANTITY), MAX_QUANTITY);
}
