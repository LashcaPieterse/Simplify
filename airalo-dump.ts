import { AiraloClient } from "./lib/airalo/client";

async function main() {
  const client = new AiraloClient({
    clientId: process.env.AIRALO_CLIENT_ID!,
    clientSecret: process.env.AIRALO_CLIENT_SECRET!,
  });

  const token = await (client as unknown as { getAccessToken(): Promise<string> }).getAccessToken();
  console.log("token prefix", typeof token === "string" ? token.slice(0, 10) : token);

  const res = await fetch("https://partners-api.airalo.com/v2/packages?limit=5&page=1", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  console.log("status", res.status);
  const json = await res.json().catch(async () => ({ text: await res.text() }));
  console.dir(json, { depth: null });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
