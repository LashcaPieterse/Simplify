import prisma from "../lib/db/client";
import { syncCatalogToSanity } from "../lib/sanity/sync-catalog";

async function main() {
  try {
    await syncCatalogToSanity();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[sanity-sync] Failed to sync catalog to Sanity", error);
  process.exit(1);
});
