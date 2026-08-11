"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/cart";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || (v.length === 12 && v.startsWith("91")), {
      message: "Enter a valid 10-digit Indian mobile number.",
    }),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "PIN code must be 6 digits."),
  isDefault: z.boolean().optional(),
});

async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

export async function saveAddress(
  input: z.infer<typeof addressSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCustomer();
  if (!user) return { ok: false, error: "Sign in to manage addresses." };

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address." };
  }

  const data = parsed.data;
  const phone =
    data.phone.length === 12 ? data.phone.slice(2) : data.phone;

  const count = await prisma.address.count({ where: { userId: user.id } });
  const makeDefault = data.isDefault || count === 0;

  if (makeDefault) {
    await prisma.address.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  if (data.id) {
    const owned = await prisma.address.findFirst({
      where: { id: data.id, userId: user.id },
    });
    if (!owned) return { ok: false, error: "Address not found." };

    const updated = await prisma.address.update({
      where: { id: data.id },
      data: {
        label: data.label || null,
        fullName: data.fullName,
        phone,
        line1: data.line1,
        line2: data.line2 || null,
        landmark: data.landmark || null,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        isDefault: makeDefault || owned.isDefault,
      },
    });
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { ok: true, data: { id: updated.id } };
  }

  const created = await prisma.address.create({
    data: {
      userId: user.id,
      label: data.label || null,
      fullName: data.fullName,
      phone,
      line1: data.line1,
      line2: data.line2 || null,
      landmark: data.landmark || null,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: "India",
      isDefault: makeDefault,
    },
  });

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, data: { id: created.id } };
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  const user = await requireCustomer();
  if (!user) return { ok: false, error: "Sign in to manage addresses." };

  const owned = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!owned) return { ok: false, error: "Address not found." };

  await prisma.address.delete({ where: { id: addressId } });

  if (owned.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    if (next) {
      await prisma.address.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function setDefaultAddress(addressId: string): Promise<ActionResult> {
  const user = await requireCustomer();
  if (!user) return { ok: false, error: "Sign in to manage addresses." };

  const owned = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!owned) return { ok: false, error: "Address not found." };

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true };
}
