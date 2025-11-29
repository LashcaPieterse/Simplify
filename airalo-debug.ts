import { AiraloClient } from "./lib/airalo/client";

async function main() {
  const client = new AiraloClient({
    clientId: process.env.AIRALO_CLIENT_ID!,
    clientSecret: process.env.AIRALO_CLIENT_SECRET!,
  });

  try {
    // @ts-expect-error accessing private
    const token = await (client as any).getAccessToken();
    console.log("token", typeof token === "string" ? token.slice(0, 10) + "..." : token);
  } catch (err: any) {
    console.error("token error", err?.details ?? err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
