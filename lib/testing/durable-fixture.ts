/** Minimal in-memory outbox for unit fixtures; database behavior is covered separately. */
export function fixtureOutbox() {
  const records = new Map<string, Record<string, unknown>>();
  return {
    records,
    upsert: async ({ where, create }: { where: { businessKey: string }; create: Record<string, unknown> }) => {
      const current = records.get(where.businessKey);
      if (current) return current;
      const record = { id: `fixture-${records.size + 1}`, ...create };
      records.set(where.businessKey, record);
      return record;
    },
  };
}
