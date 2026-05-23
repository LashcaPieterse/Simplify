export function serialise(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    return JSON.stringify({ error: String(error) });
  }
}

export function appendStatusHistory(
  history: string | null,
  event: unknown,
): string {
  let items: unknown[] = [];

  if (history) {
    try {
      const parsed = JSON.parse(history);
      if (Array.isArray(parsed)) {
        items = parsed;
      }
    } catch {
      items = [history];
    }
  }

  items.push(event);
  return serialise(items);
}

export function createStatusHistory(event: unknown): string {
  return serialise([event]);
}
