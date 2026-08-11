"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { failField, failWrite, failZod } from "@/lib/action-errors";
import { assertStaff, assertAdmin, recordAudit } from "@/lib/session";
import { uploadProductImage } from "@/lib/storage";
import type { ActionResult } from "@/app/actions/cart";

const slideSchema = z.object({
  id: z.string().optional(),
  eyebrow: z.string().trim().max(60).optional(),
  title: z.string().trim().min(3, "Give the slide a headline.").max(120),
  subtitle: z.string().trim().max(240).optional(),
  imageUrl: z.string().trim().min(1, "A slide needs an image."),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  alignment: z.enum(["left", "center", "right"]),
  sortOrder: z.number().int().min(0).max(99),
  isActive: z.boolean(),
});

export async function saveHeroSlide(input: unknown): Promise<ActionResult> {
  const actor = await assertStaff();

  const parsed = slideSchema.safeParse(input);
  if (!parsed.success) return failZod(parsed.error);
  const data = parsed.data;

  if (!data.imageUrl.trim()) {
    return failField("imageUrl", "A slide needs an image.");
  }

  const payload = {
    eyebrow: data.eyebrow || null,
    title: data.title,
    subtitle: data.subtitle || null,
    imageUrl: data.imageUrl,
    ctaLabel: data.ctaLabel || null,
    ctaHref: data.ctaHref || null,
    alignment: data.alignment,
    sortOrder: data.sortOrder,
    isActive: data.isActive,
  };

  try {
    const slide = data.id
      ? await prisma.heroSlide.update({ where: { id: data.id }, data: payload })
      : await prisma.heroSlide.create({ data: payload });

    await recordAudit({
      actor,
      action: data.id ? "hero.update" : "hero.create",
      entity: "HeroSlide",
      entityId: slide.id,
      after: slide,
    });

    revalidatePath("/");
    revalidatePath("/admin/content");
    return { ok: true };
  } catch (err) {
    return failWrite(err);
  }
}

export async function deleteHeroSlide(slideId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const slide = await prisma.heroSlide.findUnique({
    where: { id: slideId },
    select: { title: true },
  });
  if (!slide) return { ok: false, error: "That slide is already gone." };

  await prisma.heroSlide.delete({ where: { id: slideId } });
  await recordAudit({
    actor,
    action: "hero.delete",
    entity: "HeroSlide",
    entityId: slideId,
    before: slide,
  });

  revalidatePath("/");
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function reorderHeroSlides(slideIds: string[]): Promise<ActionResult> {
  await assertStaff();

  await prisma.$transaction(
    slideIds.map((id, index) =>
      prisma.heroSlide.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  revalidatePath("/");
  revalidatePath("/admin/content");
  return { ok: true };
}

/** Hero art lives in the public product bucket — same CDN, same policy. */
export async function uploadHeroImage(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  await assertStaff();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image." };
  }

  const uploaded = await uploadProductImage("hero", file);
  if (!uploaded.ok) return { ok: false, error: uploaded.error };
  if (!uploaded.publicUrl) {
    return { ok: false, error: "Stored, but no public URL came back." };
  }

  return { ok: true, data: { url: uploaded.publicUrl } };
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]),
});

export async function setUserRole(input: unknown): Promise<ActionResult> {
  const actor = await assertAdmin();

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { userId, role } = parsed.data;

  if (userId === actor.id) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!user) return { ok: false, error: "That account no longer exists." };

  // Never leave the shop without an owner.
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return { ok: false, error: "There has to be at least one administrator." };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await recordAudit({
    actor,
    action: "user.role",
    entity: "User",
    entityId: userId,
    before: { role: user.role },
    after: { email: user.email, role },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserBanned(input: {
  userId: string;
  banned: boolean;
}): Promise<ActionResult> {
  const actor = await assertAdmin();

  if (input.userId === actor.id) {
    return { ok: false, error: "You cannot lock yourself out." };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, role: true },
  });
  if (!user) return { ok: false, error: "That account no longer exists." };

  await prisma.user.update({
    where: { id: input.userId },
    data: { banned: input.banned },
  });
  // Suspending has to end live sessions, otherwise the cookie keeps working.
  if (input.banned) {
    await prisma.session.deleteMany({ where: { userId: input.userId } });
  }

  await recordAudit({
    actor,
    action: input.banned ? "user.suspend" : "user.restore",
    entity: "User",
    entityId: input.userId,
    after: { email: user.email, banned: input.banned },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function markContactHandled(messageId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const message = await prisma.contactMessage.findUnique({
    where: { id: messageId },
    select: { isHandled: true, email: true },
  });
  if (!message) return { ok: false, error: "That message no longer exists." };

  await prisma.contactMessage.update({
    where: { id: messageId },
    data: { isHandled: !message.isHandled },
  });

  await recordAudit({
    actor,
    action: "contact.handled",
    entity: "ContactMessage",
    entityId: messageId,
    after: { email: message.email, isHandled: !message.isHandled },
  });

  revalidatePath("/admin/notifications");
  return { ok: true };
}
