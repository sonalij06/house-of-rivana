/**
 * Exercises the Razorpay webhook handler without the gateway: signs a body with
 * the configured secret and checks verification, capture, amount-mismatch and
 * replay behaviour against the real database.
 */
import crypto from "node:crypto";
import { prisma } from "../src/lib/db";
import { razorpayProvider } from "../src/lib/payments/razorpay";

const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
const sign = (body: string) =>
  crypto.createHmac("sha256", secret).update(body).digest("hex");

// Attach a fake Razorpay payment row to a real pending order.
const order = await prisma.order.findFirst({
  where: { status: "PENDING_PAYMENT" },
  select: { id: true, orderNumber: true, grandTotalPaise: true },
});
if (!order) throw new Error("Seed a PENDING_PAYMENT order first (run smoke-checkout).");

const providerOrderId = `order_test_${Date.now()}`;
const payment = await prisma.payment.create({
  data: {
    orderId: order.id,
    provider: "RAZORPAY",
    status: "AWAITING_CONFIRMATION",
    amountPaise: order.grandTotalPaise,
    providerOrderId,
  },
});

const body = (amount: number, event = "payment.captured", id = `pay_${Date.now()}`) =>
  JSON.stringify({
    event,
    payload: {
      payment: {
        entity: { id, order_id: providerOrderId, amount, method: "upi", vpa: "test@okaxis" },
      },
    },
  });

console.log("order:", order.orderNumber, `₹${order.grandTotalPaise / 100}`);

const tampered = body(order.grandTotalPaise);
console.log(
  "bad signature ->",
  JSON.stringify(await razorpayProvider.handleWebhook!(tampered, "not-a-signature")),
);

const wrongAmount = body(order.grandTotalPaise - 100);
console.log(
  "amount mismatch ->",
  JSON.stringify(await razorpayProvider.handleWebhook!(wrongAmount, sign(wrongAmount))),
);
console.log(
  "  order now:",
  (await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } }))
    ?.status,
);

const captureId = `pay_ok_${Date.now()}`;
const good = body(order.grandTotalPaise, "payment.captured", captureId);
console.log("valid capture ->", JSON.stringify(await razorpayProvider.handleWebhook!(good, sign(good))));
console.log("replay        ->", JSON.stringify(await razorpayProvider.handleWebhook!(good, sign(good))));

const after = await prisma.order.findUnique({
  where: { id: order.id },
  select: {
    status: true,
    paidAt: true,
    stockCommitted: true,
    movements: { select: { reason: true, delta: true, balanceAfter: true } },
    payments: { where: { id: payment.id }, select: { status: true, providerPaymentId: true } },
  },
});
console.log("after capture:", JSON.stringify(after));

const events = await prisma.webhookEvent.findMany({
  where: { provider: "RAZORPAY" },
  orderBy: { createdAt: "desc" },
  take: 4,
  select: { eventId: true, signatureOk: true, processedAt: true, error: true },
});
console.log("webhook events:", JSON.stringify(events, null, 1));

await prisma.$disconnect();
