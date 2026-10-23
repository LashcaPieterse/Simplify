import { AsyncLocalStorage } from "node:async_hooks";

// Keep the account reservation inside the request, never in client headers.
// The route enforces the quota so errors retain API 429/503 semantics; the
// credentials provider refunds only this reservation after valid credentials.
const customerLogin = new AsyncLocalStorage<string[]>();
export const customerLoginReservation = () => customerLogin.getStore();
export function withCustomerLoginReservation<T>(keys: string[], action: () => T): T {
  return customerLogin.run(keys, action);
}
