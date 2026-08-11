import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { env, features } from "@/lib/env";
import type { EmailTemplate } from "@/lib/notifications/templates";

/**
 * Notification channels behind one call. Delivery never throws into the caller:
 * an order must not fail because Resend is down. Every attempt is written to
 * NotificationLog so /admin can see what went out and retry.
 */

export type SendResult = {
  ok: boolean;
  providerId?: string;
  error?: string;
  skipped?: boolean;
};

let resendClient: Resend | null = null;
function resend() {
  if (!features.email) return null;
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

async function log(input: {
  channel: "EMAIL" | "WHATSAPP";
  template: string;
  recipient: string;
  subject?: string;
  orderId?: string;
  result: SendResult;
  attempts: number;
}) {
  try {
    await prisma.notificationLog.create({
      data: {
        channel: input.channel,
        template: input.template,
        recipient: input.recipient,
        subject: input.subject,
        orderId: input.orderId,
        status: input.result.skipped
          ? "SKIPPED"
          : input.result.ok
            ? "SENT"
            : "FAILED",
        providerId: input.result.providerId,
        error: input.result.error,
        attempts: input.attempts,
        sentAt: input.result.ok ? new Date() : null,
      },
    });
  } catch (error) {
    console.error("Failed to write notification log", error);
  }
}

export async function sendEmail(input: {
  to: string;
  template: EmailTemplate;
  templateName: string;
  orderId?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const client = resend();

  if (!client) {
    // Development without a Resend key: log the payload so flows stay testable.
    console.info(
      `[email:skipped] ${input.templateName} -> ${input.to} :: ${input.template.subject}`,
    );
    const result: SendResult = { ok: false, skipped: true, error: "RESEND_API_KEY not set" };
    await log({
      channel: "EMAIL",
      template: input.templateName,
      recipient: input.to,
      subject: input.template.subject,
      orderId: input.orderId,
      result,
      attempts: 0,
    });
    return result;
  }

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await client.emails.send({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.template.subject,
        html: input.template.html,
        text: input.template.text,
        replyTo: input.replyTo,
      });

      if (response.error) {
        lastError = response.error.message;
      } else {
        const result: SendResult = { ok: true, providerId: response.data?.id };
        await log({
          channel: "EMAIL",
          template: input.templateName,
          recipient: input.to,
          subject: input.template.subject,
          orderId: input.orderId,
          result,
          attempts: attempt,
        });
        return result;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
  }

  const result: SendResult = { ok: false, error: lastError };
  await log({
    channel: "EMAIL",
    template: input.templateName,
    recipient: input.to,
    subject: input.template.subject,
    orderId: input.orderId,
    result,
    attempts: 2,
  });
  return result;
}

/**
 * WhatsApp Cloud API. Meta only permits free-form text inside a 24-hour customer
 * service window; outside it a pre-approved template is required. We send text
 * and record the failure, which the admin can follow up with a wa.me link.
 */
export async function sendWhatsApp(input: {
  to: string;
  body: string;
  templateName: string;
  orderId?: string;
}): Promise<SendResult> {
  const to = normalisePhone(input.to);

  if (!features.whatsapp || !to) {
    const result: SendResult = {
      ok: false,
      skipped: true,
      error: !to ? "No valid phone number" : "WhatsApp credentials not set",
    };
    await log({
      channel: "WHATSAPP",
      template: input.templateName,
      recipient: input.to,
      orderId: input.orderId,
      result,
      attempts: 0,
    });
    return result;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: true, body: input.body },
        }),
      },
    );

    const payload = (await response.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    const result: SendResult = response.ok
      ? { ok: true, providerId: payload.messages?.[0]?.id }
      : { ok: false, error: payload.error?.message ?? `HTTP ${response.status}` };

    await log({
      channel: "WHATSAPP",
      template: input.templateName,
      recipient: to,
      orderId: input.orderId,
      result,
      attempts: 1,
    });
    return result;
  } catch (error) {
    const result: SendResult = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    await log({
      channel: "WHATSAPP",
      template: input.templateName,
      recipient: to,
      orderId: input.orderId,
      result,
      attempts: 1,
    });
    return result;
  }
}

/** Cloud API wants digits only, country code included, no plus. */
export function normalisePhone(input: string | null | undefined) {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** Click-to-chat fallback shown in the admin when the API is unavailable. */
export function whatsappLink(phone: string, message: string) {
  const to = normalisePhone(phone);
  if (!to) return null;
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

export async function retryNotification(notificationId: string) {
  const record = await prisma.notificationLog.findUnique({
    where: { id: notificationId },
  });
  if (!record) return { ok: false, error: "Notification not found" };
  if (record.channel !== "EMAIL") {
    return { ok: false, error: "Only email notifications can be replayed" };
  }
  // Replaying rebuilds the template from the order rather than storing the body.
  return { ok: false, error: "Resend the order email from the order page" };
}
