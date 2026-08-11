/**
 * Client-safe order vocabulary. Mirrors the Prisma enums as plain unions so
 * client components can render statuses without importing the Prisma client.
 */

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_UNDER_REVIEW"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "RETURN_REQUESTED"
  | "RETURNED";

export type PaymentStatus =
  | "INITIATED"
  | "AWAITING_CONFIRMATION"
  | "UNDER_REVIEW"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type ShipmentStatus =
  | "PENDING"
  | "LABEL_CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED_ATTEMPT"
  | "RETURNED_TO_ORIGIN"
  | "CANCELLED";

/** Wording the customer sees — written as reassurance, not as database state. */
export const ORDER_STATUS_COPY: Record<
  OrderStatus,
  { label: string; detail: string; tone: "neutral" | "warning" | "success" | "danger" }
> = {
  PENDING_PAYMENT: {
    label: "Awaiting payment",
    detail: "Complete the payment to confirm your order. Your pieces are held meanwhile.",
    tone: "warning",
  },
  PAYMENT_UNDER_REVIEW: {
    label: "Verifying payment",
    detail:
      "We are matching your UPI reference against our account. You will hear from us within a couple of hours during business time.",
    tone: "warning",
  },
  CONFIRMED: {
    label: "Confirmed",
    detail: "Payment received. Your order is queued for final finishing and QC.",
    tone: "success",
  },
  PROCESSING: {
    label: "Being prepared",
    detail: "Being checked, packed and prepared for its Rivana box.",
    tone: "neutral",
  },
  PACKED: {
    label: "Packed",
    detail: "Boxed, sealed and waiting for the courier pickup.",
    tone: "neutral",
  },
  SHIPPED: {
    label: "Shipped",
    detail: "On its way to you. Track it with the number below.",
    tone: "neutral",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    detail: "With the courier for delivery today. Someone will need to sign for it.",
    tone: "neutral",
  },
  DELIVERED: {
    label: "Delivered",
    detail: "Signed for at your address. We hope you love it.",
    tone: "success",
  },
  CANCELLED: {
    label: "Cancelled",
    detail: "This order was cancelled and nothing was dispatched.",
    tone: "danger",
  },
  REFUNDED: {
    label: "Refunded",
    detail: "The amount has been returned to your original payment method.",
    tone: "neutral",
  },
  RETURN_REQUESTED: {
    label: "Return requested",
    detail: "We have your return request and will email pickup instructions.",
    tone: "warning",
  },
  RETURNED: {
    label: "Returned",
    detail: "The parcel is back with us and your refund is being processed.",
    tone: "neutral",
  },
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  INITIATED: "Started",
  AWAITING_CONFIRMATION: "Awaiting your reference",
  UNDER_REVIEW: "Under review",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  PENDING: "Awaiting pickup",
  LABEL_CREATED: "Label created",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED_ATTEMPT: "Delivery attempted",
  RETURNED_TO_ORIGIN: "Returned to us",
  CANCELLED: "Cancelled",
};

/** Statuses a customer may still cancel from without contacting us. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_UNDER_REVIEW",
  "CONFIRMED",
  "PROCESSING",
];

export function orderStatusLabel(status: OrderStatus) {
  return ORDER_STATUS_COPY[status].label;
}
