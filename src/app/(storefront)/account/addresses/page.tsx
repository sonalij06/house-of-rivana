import type { Metadata } from "next";
import { AddressManager } from "@/components/account/address-manager";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Addresses",
  robots: { index: false, follow: false },
};

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Addresses</h2>
      <p className="mt-1 text-sm text-muted">
        Saved shipping addresses for faster checkout across India.
      </p>
      <div className="mt-8">
        <AddressManager
          addresses={addresses.map((a) => ({
            id: a.id,
            label: a.label,
            fullName: a.fullName,
            phone: a.phone,
            line1: a.line1,
            line2: a.line2,
            landmark: a.landmark,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            isDefault: a.isDefault,
          }))}
        />
      </div>
    </div>
  );
}
