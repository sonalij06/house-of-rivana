/** Verifies stock reservation, the ledger and the expired-hold sweeper. */
import { prisma } from "../src/lib/db";
import { releaseExpiredHolds } from "../src/lib/order-service";

const orders = await prisma.order.findMany({
  orderBy: { placedAt: "desc" },
  take: 5,
  select: {
    orderNumber: true,
    status: true,
    grandTotalPaise: true,
    stockCommitted: true,
    stockHoldExpiresAt: true,
    items: { select: { sku: true, quantity: true } },
    movements: { select: { reason: true, delta: true, balanceAfter: true } },
    payments: { select: { provider: true, status: true, upiUtr: true, proofPath: true } },
    timeline: { select: { type: true }, orderBy: { createdAt: "asc" } },
  },
});

for (const order of orders) {
  console.log(
    [
      order.orderNumber,
      order.status,
      `₹${order.grandTotalPaise / 100}`,
      `committed=${order.stockCommitted}`,
      `hold=${order.stockHoldExpiresAt?.toISOString().slice(11, 19) ?? "none"}`,
      `items=${order.items.map((i) => `${i.sku}×${i.quantity}`).join(",")}`,
      `movements=${order.movements.map((m) => `${m.reason}${m.delta > 0 ? "+" : ""}${m.delta}→${m.balanceAfter}`).join(",") || "none"}`,
      `payment=${order.payments.map((p) => `${p.provider}/${p.status}/${p.upiUtr ?? "-"}/${p.proofPath ? "proof" : "no-proof"}`).join(" ")}`,
      `timeline=${order.timeline.map((t) => t.type).join(">")}`,
    ].join(" | "),
  );
}

const variant = await prisma.productVariant.findFirst({
  where: { sku: { not: "" } },
  select: { sku: true, stockQty: true, reservedQty: true },
  orderBy: { reservedQty: "desc" },
});
console.log("most-reserved variant:", JSON.stringify(variant));

// Force one pending order to look expired, then run the sweeper.
const pending = await prisma.order.findFirst({
  where: { status: "PENDING_PAYMENT", stockCommitted: false },
  select: { id: true, orderNumber: true },
});

if (pending) {
  await prisma.order.update({
    where: { id: pending.id },
    data: { stockHoldExpiresAt: new Date(Date.now() - 60_000) },
  });
  const result = await releaseExpiredHolds();
  console.log("sweeper:", JSON.stringify(result));

  const after = await prisma.order.findUnique({
    where: { id: pending.id },
    select: { status: true, payments: { select: { status: true } } },
  });
  console.log(`${pending.orderNumber} after sweep:`, JSON.stringify(after));
} else {
  console.log("sweeper: no pending order to expire");
}

await prisma.$disconnect();
