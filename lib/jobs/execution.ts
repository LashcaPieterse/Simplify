import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";

export type ProcessingTrigger = "browser" | "dpo_push" | "supplier_webhook" | "recovery";
type ProcessingContext = { trigger: ProcessingTrigger; correlationId: string; deadline: number; signal: AbortSignal };
const execution = new AsyncLocalStorage<ProcessingContext>();

export function processingContext() { return execution.getStore(); }

export function withProcessingContext<T>(input: Omit<ProcessingContext, "signal">, work: () => Promise<T>) {
  const parent = execution.getStore();
  const deadline = Math.min(input.deadline, parent?.deadline ?? Infinity);
  const signal = AbortSignal.any([
    AbortSignal.timeout(Math.max(0, Math.ceil(deadline - Date.now()))),
    ...(parent ? [parent.signal] : []),
  ]);
  return execution.run({ ...input, deadline, signal }, work);
}

/** Apply the workflow deadline without replacing a provider's shorter timeout. */
export function providerSignal(timeoutMs: number, supplied?: AbortSignal | null) {
  const signal = supplied ?? AbortSignal.timeout(timeoutMs);
  const context = execution.getStore();
  return context ? AbortSignal.any([signal, context.signal]) : signal;
}

export async function processingWait(ms: number) {
  await delay(Math.max(0, ms), undefined, { signal: execution.getStore()?.signal });
}
