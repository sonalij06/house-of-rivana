"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCartSnapshot } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { createOrder, type ShippingAddressSnapshot } from "@/lib/orders";
import { notifyOrderReceived } from "@/lib/order-service";
import { getActiveProvider } from "@/lib/payments";
import { PaymentConfigError } from "@/lib/payments/types";
import { uploadPaymentProof } from "@/lib/storage";
import { isValidUtr } from "@/lib/payments/upi";
import type { ActionResult } from "@/app/actions/cart";

const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number."),
  line1: z.string().trim().min(4, "Enter the street address.").max(160),
  line2: z.string().trim().max(160).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  state: z.string().trim().min(2, "Choose the state.").max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code."),
  country: z.string().trim().default("India"),
});

const checkoutSchema = z.object({
  email: z.string().trim().email("Enter an email we can send the receipt to."),
  address: addressSchema,
  savedAddressId: z.string().optional(),
  saveAddress: z.boolean().optional(),
  customerNote: z.string().trim().max(500).optional(),
  giftWrap: z.boolean().optional(),
});

async function clientKey(prefix: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${prefix}:${ip}`;
}

/**
 * Creates the order from the server's own view of the cart. The client submits
 * only contact and address details — never prices, quantities or totals.
 */
export async function placeOrder(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string; accessToken: string }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const limit = await checkRateLimit(await clientKey("checkout"), {
    max: 8,
    windowMs: 10 * 60_000,
  });
  if (!limit.allowed) {
    return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  }

  const snapshot = await getCartSnapshot();
  if (snapshot.lines.length === 0) {
    return { ok: false, error: "Your bag is empty." };
  }
  if (snapshot.issues.length > 0) {
    return {
      ok: false,
      error: `${snapshot.issues[0].message} Review your bag and try again.`,
    };
  }

  const user = await getCurrentUser();
  const data = parsed.data;
  const address: ShippingAddressSnapshot = {
    ...data.address,
    line2: data.address.line2 || null,
    landmark: data.address.landmark || null,
    country: data.address.country || "India",
  };

  const created = await createOrder({
    snapshot,
    userId: user?.id ?? null,
    email: data.email,
    phone: address.phone,
    shippingAddress: address,
    customerNote: data.customerNote,
    giftWrap: data.giftWrap,
  });
  if (!created.ok) return { ok: false, error: created.error };

  // The bag is emptied only once the order exists, so a failure above leaves the
  // shopper exactly where they were.
  if (snapshot.cartId) {
    await prisma.cartItem.deleteMany({ where: { cartId: snapshot.cartId } });
    await prisma.cart.update({
      where: { id: snapshot.cartId },
      data: { couponCode: null },
    });
  }

  if (user && data.saveAddress) {
    await prisma.address.create({
      data: { userId: user.id, ...address, isDefault: false },
    });
  }

  await notifyOrderReceived(created.orderId);

  revalidatePath("/", "layout");
  return {
    ok: true,
    data: { orderNumber: created.orderNumber, accessToken: created.accessToken },
  };
}

/**
 * Issues the payment intent for an order. Called from the payment page rather
 * than at order creation so a refresh re-renders a live QR without a new order.
 */
export async function startPayment(
  orderNumber: string,
  token?: string,
): Promise<
  ActionResult<{
    kind: "upi_uri" | "razorpay_checkout";
    paymentId: string;
    uri?: string;
    qrDataUrl?: string;
    payeeVpa?: string;
    payeeName?: string;
    providerOrderId?: string;
    keyId?: string;
    amountPaise: number;
    expiresAt: string;
  }>
> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      grandTotalPaise: true,
      email: true,
      phone: true,
      accessToken: true,
      userId: true,
      stockHoldExpiresAt: true,
      shippingAddress: true,
    },
  });
  if (!order) return { ok: false, error: "That order could not be found." };

  const user = await getCurrentUser();
  const authorised =
    (user && order.userId === user.id) || (token && token === order.accessToken);
  if (!authorised) return { ok: false, error: "That order is not yours to pay." };

  if (order.status !== "PENDING_PAYMENT") {
    return { ok: false, error: "This order is not awaiting payment." };
  }

  const provider = await getActiveProvider();
  const address = order.shippingAddress as { fullName?: string } | null;

  try {
    const intent = await provider.createIntent({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountPaise: order.grandTotalPaise,
      customerName: address?.fullName ?? "Customer",
      customerEmail: order.email,
      customerPhone: order.phone,
      expiresAt: order.stockHoldExpiresAt ?? new Date(Date.now() + 45 * 60_000),
    });

    return {
      ok: true,
      data:
        intent.kind === "upi_uri"
          ? {
              kind: "upi_uri",
              paymentId: intent.paymentId,
              uri: intent.uri,
              qrDataUrl: intent.qrDataUrl,
              payeeVpa: intent.payeeVpa,
              payeeName: intent.payeeName,
              amountPaise: intent.amountPaise,
              expiresAt: intent.expiresAt.toISOString(),
            }
          : {
              kind: "razorpay_checkout",
              paymentId: intent.paymentId,
              providerOrderId: intent.providerOrderId,
              keyId: intent.keyId,
              amountPaise: intent.amountPaise,
              expiresAt: intent.expiresAt.toISOString(),
            },
    };
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return { ok: false, error: error.message };
    }
    console.error("startPayment failed", error);
    return { ok: false, error: "We could not start that payment. Please try again." };
  }
}

/**
 * UTR plus optional screenshot. Takes FormData because the file has to travel as
 * multipart; everything is re-validated server side.
 */
export async function submitPaymentProof(
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const token = String(formData.get("token") ?? "") || undefined;
  const paymentId = String(formData.get("paymentId") ?? "");
  const utr = String(formData.get("utr") ?? "");
  const payerVpa = String(formData.get("payerVpa") ?? "") || undefined;
  const payerName = String(formData.get("payerName") ?? "") || undefined;
  const file = formData.get("proof");

  if (!isValidUtr(utr)) {
    return {
      ok: false,
      error: "A UPI reference number is 12 digits. Check your payment app.",
    };
  }

  const limit = await checkRateLimit(await clientKey("proof"), {
    max: 10,
    windowMs: 10 * 60_000,
  });
  if (!limit.allowed) {
    return { ok: false, error: "Too many submissions. Please wait a few minutes." };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, accessToken: true, userId: true, orderNumber: true, status: true },
  });
  if (!order) return { ok: false, error: "That order could not be found." };

  const user = await getCurrentUser();
  const authorised =
    (user && order.userId === user.id) || (token && token === order.accessToken);
  if (!authorised) return { ok: false, error: "That order is not yours." };

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, orderId: order.id },
    select: { id: true, provider: true },
  });
  if (!payment) return { ok: false, error: "Start the payment again and retry." };

  let proofPath: string | undefined;
  let proofMimeType: string | undefined;
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadPaymentProof(order.orderNumber, file);
    if (!uploaded.ok) {
      // A missing screenshot must not block the UTR, which is the evidence that
      // actually matters when reconciling against the bank statement.
      console.warn(`proof upload skipped for ${order.orderNumber}: ${uploaded.error}`);
    } else {
      proofPath = uploaded.path;
      proofMimeType = file.type;
    }
  }

  const { providerForKind } = await import("@/lib/payments");
  const provider = providerForKind(payment.provider);
  if (!provider.submitProof) {
    return { ok: false, error: "This payment method is confirmed automatically." };
  }

  const result = await provider.submitProof({
    orderId: order.id,
    paymentId: payment.id,
    utr,
    payerVpa,
    payerName,
    proofPath,
    proofMimeType,
  });
  if (!result.ok) return { ok: false, error: result.error };

  // Deliberately no revalidatePath: it would re-render the payment route, which
  // redirects once the order leaves PENDING_PAYMENT and would erase the
  // confirmation the buyer needs to read. /order/[orderNumber] is dynamic anyway.
  return { ok: true, data: { message: result.message } };
}

/** Lets a customer abandon an unpaid order and put the stock back immediately. */
export async function abandonOrder(
  orderNumber: string,
  token?: string,
): Promise<ActionResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, accessToken: true, userId: true, status: true },
  });
  if (!order) return { ok: false, error: "That order could not be found." };

  const user = await getCurrentUser();
  const authorised =
    (user && order.userId === user.id) || (token && token === order.accessToken);
  if (!authorised) return { ok: false, error: "That order is not yours." };
  if (order.status !== "PENDING_PAYMENT") {
    return { ok: false, error: "This order can no longer be cancelled here." };
  }

  const { cancelOrder } = await import("@/lib/order-service");
  const result = await cancelOrder(order.id, "Cancelled by the customer before payment.");
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saved addresses for the checkout picker. */
export async function listSavedAddresses() {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}
