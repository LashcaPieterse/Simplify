import prisma from "../lib/db/client";
import { recoverAiraloOrders } from "../lib/orders/recovery";

const args = process.argv.slice(2);
const orderId = args.length === 2 && args[0] === "--order-id" ? args[1] : undefined;
if (args.length && !orderId) {
  throw new Error("Usage: npm run airalo:recover-orders -- [--order-id LOCAL_ORDER_ID]");
}

recoverAiraloOrders({ orderId })
  .then((summary) => console.info(summary))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
