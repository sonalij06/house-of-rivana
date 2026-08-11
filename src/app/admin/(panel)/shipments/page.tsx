import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminHeader, DataTable, Panel, StatusPill, Td } from "@/components/admin/primitives";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { SHIPMENT_STATUS_LABEL, type ShipmentStatus } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Shipments" };

export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff("/admin/shipments");
  const { status } = await searchParams;

  const filters: { key: string; label: string }[] = [
    { key: "active", label: "In transit" },
    ...Object.entries(SHIPMENT_STATUS_LABEL).map(([key, label]) => ({ key, label })),
    { key: "all", label: "All" },
  ];
  const active = filters.find((f) => f.key === status) ?? filters[0];

  const shipments = await prisma.shipment.findMany({
    where:
      active.key === "all"
        ? {}
        : active.key === "active"
          ? { status: { in: ["PENDING", "LABEL_CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] } }
          : { status: active.key as ShipmentStatus },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          shippingAddress: true,
          email: true,
        },
      },
      events: { orderBy: { occurredAt: "desc" }, take: 1 },
    },
  });

  return (
    <>
      <AdminHeader
        title="Shipments"
        description="Every parcel that has left the studio. Tracking updates are added from the order page."
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-hairline pb-3">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/admin/shipments?status=${filter.key}`}
            className={
              filter.key === active.key
                ? "rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-cream"
                : "rounded-xs px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:bg-cream-dark hover:text-ink"
            }
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <Panel padded={false}>
        <DataTable
          head={["Order", "Carrier & AWB", "Destination", "Last update", "Status"]}
          empty="No shipments in this view."
        >
          {shipments.map((shipment) => {
            const address = shipment.order.shippingAddress as {
              fullName?: string;
              city?: string;
              state?: string;
            } | null;
            return (
              <tr key={shipment.id} className="transition-colors hover:bg-cream">
                <Td>
                  <Link
                    href={`/admin/orders/${shipment.order.id}`}
                    className="font-mono text-[0.75rem] text-ink underline-offset-4 hover:underline"
                  >
                    {shipment.order.orderNumber}
                  </Link>
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {formatDate(shipment.createdAt)}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-ink">{shipment.carrier}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.6875rem] text-muted">
                    {shipment.awb}
                    {shipment.trackingUrl ? (
                      <a
                        href={shipment.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open the carrier tracking page"
                        className="text-gold"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-ink">{address?.fullName ?? "—"}</span>
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {address?.city}
                    {address?.state ? `, ${address.state}` : ""}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-muted">
                    {shipment.events[0]?.description ?? "Awaiting first scan"}
                  </span>
                  {shipment.events[0] ? (
                    <span className="mt-0.5 block text-[0.625rem] tabular-nums text-muted-light">
                      {formatDate(shipment.events[0].occurredAt, true)}
                    </span>
                  ) : null}
                </Td>
                <Td align="right">
                  <StatusPill
                    status={shipment.status}
                    label={SHIPMENT_STATUS_LABEL[shipment.status as ShipmentStatus]}
                  />
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </>
  );
}
