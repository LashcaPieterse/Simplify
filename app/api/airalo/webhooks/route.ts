import { handleAiraloWebhookRoute } from "@/lib/orders/airalo-webhook-route";
export { HEAD } from "@/lib/orders/airalo-webhook-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  return handleAiraloWebhookRoute(request);
}
