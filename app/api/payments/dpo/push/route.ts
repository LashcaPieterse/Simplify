import { handleDpoPushRoute } from "@/lib/payments/dpo-push-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleDpoPushRoute(request);
}
