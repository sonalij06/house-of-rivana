"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications";
import { contactReceiptEmail } from "@/lib/notifications/templates";
import { getSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/app/actions/cart";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80),
  email: z.string().trim().email("That email does not look right."),
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().max(120).optional(),
  message: z
    .string()
    .trim()
    .min(10, "A little more detail helps us help you.")
    .max(2000),
});

async function clientKey(prefix: string) {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${prefix}:${ip}`;
}

export async function submitContactMessage(
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const limit = await checkRateLimit(await clientKey("contact"), {
    max: 3,
    windowMs: 10 * 60_000,
  });
  if (!limit.allowed) {
    return {
      ok: false,
      error: "You have sent a few messages already. Try again in a little while.",
    };
  }

  const data = parsed.data;
  await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
    },
  });

  const settings = await getSettings();
  await Promise.all([
    sendEmail({
      to: data.email,
      templateName: "contact-receipt",
      template: contactReceiptEmail({ name: data.name, message: data.message }),
      replyTo: settings.supportEmail,
    }),
    settings.supportEmail
      ? sendEmail({
          to: settings.supportEmail,
          templateName: "contact-internal",
          replyTo: data.email,
          template: {
            subject: `Contact form: ${data.subject || data.name}`,
            html: `<p><strong>${data.name}</strong> (${data.email}${data.phone ? `, ${data.phone}` : ""})</p><p>${data.message.replace(/\n/g, "<br>")}</p>`,
            text: `${data.name} (${data.email})\n\n${data.message}`,
          },
        })
      : Promise.resolve(),
  ]);

  return {
    ok: true,
    data: { message: "Thank you — we will reply within one business day." },
  };
}

export async function subscribeToNewsletter(
  email: string,
): Promise<ActionResult<{ message: string }>> {
  const parsed = z.string().trim().email().safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const limit = await checkRateLimit(await clientKey("newsletter"), {
    max: 5,
    windowMs: 10 * 60_000,
  });
  if (!limit.allowed) {
    return { ok: false, error: "Please try again in a few minutes." };
  }

  // Subscribers are stored as contact messages tagged as newsletter signups,
  // which keeps one inbox for the studio to work from.
  const existing = await prisma.contactMessage.findFirst({
    where: { email: parsed.data, subject: "Newsletter signup" },
  });
  if (!existing) {
    await prisma.contactMessage.create({
      data: {
        name: parsed.data.split("@")[0],
        email: parsed.data,
        subject: "Newsletter signup",
        message: "Requested to join the mailing list from the site footer.",
      },
    });
  }

  return { ok: true, data: { message: "You are on the list." } };
}
