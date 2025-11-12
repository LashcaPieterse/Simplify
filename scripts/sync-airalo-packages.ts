/**
 * Synchronizes the Airalo catalog with the local database.
 *
 * Recommended cadence: run this script every 60 minutes via cron or a background worker
 * to keep pricing and availability fresh without overwhelming the upstream API.
 */
import { syncAiraloPackages } from "../lib/catalog/sync";

async function main() {
  const result = await syncAiraloPackages();

  console.log(
    `Synced ${result.total} packages (created: ${result.created}, updated: ${result.updated}, unchanged: ${result.unchanged}).`,
  );
}

main().catch((error) => {
  console.error("Failed to sync Airalo packages", error);
  process.exit(1);
});
