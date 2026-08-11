import { env } from "@/lib/env";
import { formatPaise } from "@/lib/utils";

/**
 * Hand-rolled HTML email. Deliberately table-free and inline-styled: every
 * major client renders this reliably, and it keeps the brand's typography
 * without pulling in a rendering dependency.
 */

const CREAM = "#faf8f5";
const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const GOLD = "#8b6914";
const HAIRLINE = "#e8e4df";

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type OrderLine = {
  productName: string;
  variantLabel: string;
  quantity: number;
  lineTotalPaise: number;
};

export type OrderEmailContext = {
  orderNumber: string;
  customerName: string;
  orderUrl: string;
  items: OrderLine[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  grandTotalPaise: number;
  brandName: string;
  supportEmail: string;
};

function shell(body: string, preheader: string) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:Helvetica,Arial,sans-serif;color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <div style="max-width:560px;margin:0 auto;padding:32px 20px 48px">
    <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid ${HAIRLINE}">
      <img src="${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/brand/logo.png" width="72" height="72" alt="House of Rivana" style="display:block;margin:0 auto;border-radius:999px" />
      <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.14em;text-transform:uppercase;color:${INK};margin-top:14px">House of Rivana</div>
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};margin-top:8px">Fashion jewellery, made to be worn</div>
    </div>
    ${body}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid ${HAIRLINE};font-size:12px;color:${MUTED};text-align:center;line-height:1.7">
      Questions? Just reply to this email and a person will answer.
    </div>
  </div>
</body>
</html>`;
}

function heading(text: string) {
  return `<h1 style="font-family:Georgia,serif;font-size:26px;font-weight:normal;line-height:1.25;margin:32px 0 12px;color:${INK}">${escapeHtml(text)}</h1>`;
}

function paragraph(text: string) {
  return `<p style="font-size:15px;line-height:1.7;color:${INK};margin:0 0 16px">${text}</p>`;
}

function muted(text: string) {
  return `<p style="font-size:13px;line-height:1.7;color:${MUTED};margin:0 0 16px">${text}</p>`;
}

function button(label: string, href: string) {
  return `<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:${INK};color:${CREAM};padding:13px 28px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none">${escapeHtml(label)}</a></p>`;
}

function itemsTable(ctx: OrderEmailContext) {
  const rows = ctx.items
    .map(
      (item) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-size:14px;color:${INK}">
          ${escapeHtml(item.productName)}
          <div style="font-size:12px;color:${MUTED};margin-top:3px">${escapeHtml(item.variantLabel)} &middot; Qty ${item.quantity}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-size:14px;color:${INK};text-align:right;white-space:nowrap">${formatPaise(item.lineTotalPaise)}</td>
      </tr>`,
    )
    .join("");

  const summaryRow = (label: string, value: string, bold = false) =>
    `<tr>
      <td style="padding:6px 0;font-size:${bold ? "15px" : "13px"};color:${bold ? INK : MUTED};${bold ? "font-weight:600;padding-top:14px" : ""}">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:${bold ? "15px" : "13px"};color:${bold ? INK : MUTED};text-align:right;${bold ? "font-weight:600;padding-top:14px" : ""}">${escapeHtml(value)}</td>
    </tr>`;

  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin:24px 0">
    ${rows}
    ${summaryRow("Subtotal", formatPaise(ctx.subtotalPaise))}
    ${ctx.discountPaise > 0 ? summaryRow("Discount", `-${formatPaise(ctx.discountPaise)}`) : ""}
    ${summaryRow("Shipping", ctx.shippingPaise === 0 ? "Complimentary" : formatPaise(ctx.shippingPaise))}
    ${summaryRow("Total", formatPaise(ctx.grandTotalPaise), true)}
  </table>`;
}

function textLines(lines: (string | false | undefined)[]) {
  return lines.filter(Boolean).join("\n\n");
}

export function orderReceivedEmail(ctx: OrderEmailContext): EmailTemplate {
  const body =
    heading(`We have your order, ${ctx.customerName.split(" ")[0]}.`) +
    paragraph(
      `Order <strong>${escapeHtml(ctx.orderNumber)}</strong> is with us. We are checking your UPI payment against our statement now — you will get a second email the moment it clears, usually within a couple of hours during business time.`,
    ) +
    itemsTable(ctx) +
    button("Track this order", ctx.orderUrl) +
    muted(
      "Nothing is dispatched until payment is verified, so no action is needed from you right now.",
    );

  return {
    subject: `We have your order ${ctx.orderNumber}`,
    html: shell(body, `Order ${ctx.orderNumber} received — verifying payment.`),
    text: textLines([
      `We have your order, ${ctx.customerName}.`,
      `Order ${ctx.orderNumber} is with us and we are verifying your UPI payment.`,
      `Total: ${formatPaise(ctx.grandTotalPaise)}`,
      `Track it here: ${ctx.orderUrl}`,
    ]),
  };
}

export function paymentVerifiedEmail(ctx: OrderEmailContext): EmailTemplate {
  const body =
    heading("Payment confirmed.") +
    paragraph(
      `Your payment for <strong>${escapeHtml(ctx.orderNumber)}</strong> has been matched and the order is confirmed. It is now with our studio for a final quality check before packing.`,
    ) +
    itemsTable(ctx) +
    button("View order", ctx.orderUrl) +
    muted("We will email tracking details as soon as the courier collects it.");

  return {
    subject: `Payment confirmed for ${ctx.orderNumber}`,
    html: shell(body, `Payment confirmed for ${ctx.orderNumber}.`),
    text: textLines([
      "Payment confirmed.",
      `Your payment for ${ctx.orderNumber} has been verified and the order is confirmed.`,
      `View order: ${ctx.orderUrl}`,
    ]),
  };
}

export function paymentRejectedEmail(
  ctx: OrderEmailContext & { reason: string },
): EmailTemplate {
  const body =
    heading("We could not match your payment.") +
    paragraph(
      `We were unable to verify the payment for <strong>${escapeHtml(ctx.orderNumber)}</strong>. Our team noted: <em>${escapeHtml(ctx.reason)}</em>`,
    ) +
    paragraph(
      "If the money did leave your account, reply to this email with a screenshot showing the UPI reference number and we will trace it. Nothing has been dispatched and no further amount will be taken.",
    ) +
    button("Retry payment", ctx.orderUrl);

  return {
    subject: `Action needed on order ${ctx.orderNumber}`,
    html: shell(body, `We could not verify payment for ${ctx.orderNumber}.`),
    text: textLines([
      "We could not match your payment.",
      `Order ${ctx.orderNumber}: ${ctx.reason}`,
      `Retry here: ${ctx.orderUrl}`,
    ]),
  };
}

export function orderShippedEmail(
  ctx: OrderEmailContext & {
    carrier: string;
    awb: string;
    trackingUrl?: string | null;
    estimatedDelivery?: string | null;
  },
): EmailTemplate {
  const body =
    heading("On its way.") +
    paragraph(
      `Order <strong>${escapeHtml(ctx.orderNumber)}</strong> has left our studio and is with ${escapeHtml(ctx.carrier)}.`,
    ) +
    `<div style="border:1px solid ${HAIRLINE};padding:16px;margin:0 0 20px">
      <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED}">Tracking number</div>
      <div style="font-size:17px;letter-spacing:0.06em;color:${INK};margin-top:6px">${escapeHtml(ctx.awb)}</div>
      ${ctx.estimatedDelivery ? `<div style="font-size:13px;color:${MUTED};margin-top:10px">Estimated delivery ${escapeHtml(ctx.estimatedDelivery)}</div>` : ""}
    </div>` +
    button("Track shipment", ctx.trackingUrl || ctx.orderUrl) +
    muted(
      "The courier requires a signature on delivery, so please make sure someone is available.",
    );

  return {
    subject: `${ctx.orderNumber} has shipped`,
    html: shell(body, `${ctx.orderNumber} is on its way — ${ctx.awb}`),
    text: textLines([
      "On its way.",
      `Order ${ctx.orderNumber} shipped via ${ctx.carrier}. Tracking: ${ctx.awb}`,
      ctx.trackingUrl ? `Track: ${ctx.trackingUrl}` : `Order: ${ctx.orderUrl}`,
    ]),
  };
}

export function orderDeliveredEmail(ctx: OrderEmailContext): EmailTemplate {
  const body =
    heading("Delivered.") +
    paragraph(
      `Order <strong>${escapeHtml(ctx.orderNumber)}</strong> has been delivered. We hope it is everything you pictured.`,
    ) +
    paragraph(
      "A reminder of the care basics: keep each piece in its own pouch, take it off before swimming or applying perfume, and use the enclosed cloth after wear.",
    ) +
    button("Leave a review", `${ctx.orderUrl}#review`) +
    muted(
      "Ring resizing is free once within ninety days, and returns are open for fifteen days on ready-to-ship pieces.",
    );

  return {
    subject: `${ctx.orderNumber} delivered`,
    html: shell(body, `${ctx.orderNumber} has been delivered.`),
    text: textLines([
      "Delivered.",
      `Order ${ctx.orderNumber} has arrived.`,
      `Leave a review: ${ctx.orderUrl}#review`,
    ]),
  };
}

export function orderCancelledEmail(
  ctx: OrderEmailContext & { reason?: string },
): EmailTemplate {
  const body =
    heading("Order cancelled.") +
    paragraph(
      `Order <strong>${escapeHtml(ctx.orderNumber)}</strong> has been cancelled${ctx.reason ? `: ${escapeHtml(ctx.reason)}` : "."} The pieces have been returned to stock.`,
    ) +
    paragraph(
      "If any amount was debited, it will be refunded to the original UPI account within five to seven business days.",
    ) +
    button("Browse the collection", `${ctx.orderUrl.split("/order/")[0]}/shop`);

  return {
    subject: `Order ${ctx.orderNumber} cancelled`,
    html: shell(body, `Order ${ctx.orderNumber} has been cancelled.`),
    text: textLines([
      "Order cancelled.",
      `Order ${ctx.orderNumber} has been cancelled.${ctx.reason ? ` Reason: ${ctx.reason}` : ""}`,
    ]),
  };
}

export function refundIssuedEmail(
  ctx: OrderEmailContext & { refundPaise: number },
): EmailTemplate {
  const body =
    heading("Refund on its way.") +
    paragraph(
      `We have issued a refund of <strong>${formatPaise(ctx.refundPaise)}</strong> against order ${escapeHtml(ctx.orderNumber)}.`,
    ) +
    paragraph(
      "It goes back to the UPI account the payment came from and typically lands within five to seven business days, depending on your bank.",
    ) +
    button("View order", ctx.orderUrl);

  return {
    subject: `Refund issued for ${ctx.orderNumber}`,
    html: shell(body, `Refund of ${formatPaise(ctx.refundPaise)} issued.`),
    text: textLines([
      "Refund on its way.",
      `${formatPaise(ctx.refundPaise)} refunded against ${ctx.orderNumber}.`,
    ]),
  };
}

export function reviewRequestEmail(
  ctx: OrderEmailContext & { productName: string; productUrl: string },
): EmailTemplate {
  const body =
    heading("How is it wearing?") +
    paragraph(
      `You have had the ${escapeHtml(ctx.productName)} for a couple of weeks now. If you have a minute, a short review helps the next person decide.`,
    ) +
    button("Write a review", `${ctx.productUrl}#reviews`) +
    muted("Honest reviews are the useful kind — three stars included.");

  return {
    subject: `How is your ${ctx.productName}?`,
    html: shell(body, "A quick review would help the next person."),
    text: textLines([
      "How is it wearing?",
      `Review your ${ctx.productName}: ${ctx.productUrl}#reviews`,
    ]),
  };
}

export function passwordResetEmail(ctx: {
  name: string;
  resetUrl: string;
}): EmailTemplate {
  const body =
    heading("Reset your password.") +
    paragraph(
      `Someone asked to reset the password for this account. If that was you, use the button below. The link expires in one hour.`,
    ) +
    button("Choose a new password", ctx.resetUrl) +
    muted(
      "If you did not request this, you can safely ignore this email — your password has not changed.",
    );

  return {
    subject: "Reset your House of Rivana password",
    html: shell(body, "Reset your password — the link expires in an hour."),
    text: textLines([
      "Reset your password.",
      `Use this link within one hour: ${ctx.resetUrl}`,
      "If you did not request this, ignore this email.",
    ]),
  };
}

export function verifyEmailTemplate(ctx: {
  name: string;
  verifyUrl: string;
}): EmailTemplate {
  const body =
    heading("Confirm your email.") +
    paragraph(
      `Welcome to House of Rivana, ${escapeHtml(ctx.name.split(" ")[0])}. Confirm this address so we can send you order updates.`,
    ) +
    button("Confirm email", ctx.verifyUrl);

  return {
    subject: "Confirm your email address",
    html: shell(body, "One tap to confirm your email."),
    text: textLines(["Confirm your email.", ctx.verifyUrl]),
  };
}

export function contactReceiptEmail(ctx: {
  name: string;
  message: string;
}): EmailTemplate {
  const body =
    heading("We got your message.") +
    paragraph(
      `Thanks for writing in, ${escapeHtml(ctx.name.split(" ")[0])}. Someone from the studio will reply within one business day.`,
    ) +
    `<div style="border-left:2px solid ${GOLD};padding-left:16px;margin:0 0 20px;font-size:14px;color:${MUTED};line-height:1.7">${escapeHtml(ctx.message)}</div>`;

  return {
    subject: "We got your message",
    html: shell(body, "We will reply within one business day."),
    text: textLines(["We got your message.", ctx.message]),
  };
}

/** WhatsApp bodies are plain text with light markdown; keep them short. */
export const whatsappTemplates = {
  orderReceived: (ctx: { orderNumber: string; total: string; url: string }) =>
    `*House of Rivana*\n\nWe have your order *${ctx.orderNumber}* for ${ctx.total}. We are verifying your UPI payment and will confirm shortly.\n\nTrack it: ${ctx.url}`,
  paymentVerified: (ctx: { orderNumber: string; url: string }) =>
    `*House of Rivana*\n\nPayment confirmed for *${ctx.orderNumber}*. Your order is now being prepared.\n\n${ctx.url}`,
  paymentRejected: (ctx: { orderNumber: string; reason: string; url: string }) =>
    `*House of Rivana*\n\nWe could not verify the payment for *${ctx.orderNumber}* — ${ctx.reason}. Nothing has been dispatched.\n\nRetry: ${ctx.url}`,
  orderShipped: (ctx: {
    orderNumber: string;
    carrier: string;
    awb: string;
    url: string;
  }) =>
    `*House of Rivana*\n\n*${ctx.orderNumber}* has shipped with ${ctx.carrier}.\nTracking: ${ctx.awb}\n\n${ctx.url}`,
  orderDelivered: (ctx: { orderNumber: string; url: string }) =>
    `*House of Rivana*\n\n*${ctx.orderNumber}* has been delivered. We hope you love it.\n\n${ctx.url}`,
  orderCancelled: (ctx: { orderNumber: string }) =>
    `*House of Rivana*\n\nOrder *${ctx.orderNumber}* has been cancelled. Any debited amount will be refunded within 5-7 business days.`,
};

export function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
