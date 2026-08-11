import { env, features } from "@/lib/env";
import type { ShipmentStatus } from "@/generated/prisma/client";

const BASE = "https://apiv2.shiprocket.in/v1/external";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export type ServiceabilityOption = {
  courierId: number;
  courierName: string;
  rate: number;
  etd: string | null;
  etdDate: Date | null;
  estimatedDays: number | null;
};

export type TrackingScan = {
  occurredAt: Date;
  activity: string;
  location: string | null;
  statusLabel: string | null;
};

export type TrackingSnapshot = {
  awb: string;
  courierName: string | null;
  currentStatus: string | null;
  etd: Date | null;
  status: ShipmentStatus;
  scans: TrackingScan[];
  trackingUrl: string;
};

export type CreatedShipment = {
  shiprocketOrderId: number;
  shipmentId: number;
  awb: string;
  courierName: string;
  etd: Date | null;
  trackingUrl: string;
  shippingCostPaise: number | null;
};

function assertConfigured() {
  if (!features.shiprocket) {
    throw new Error(
      "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.",
    );
  }
}

async function login(): Promise<string> {
  assertConfigured();
  const response = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
  };
  if (!response.ok || !payload.token) {
    throw new Error(
      payload.message ||
        `Shiprocket login failed (${response.status}). Check API user email/password.`,
    );
  }
  // Tokens last ~10 days; refresh a day early.
  tokenCache = {
    token: payload.token,
    expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000,
  };
  return payload.token;
}

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  return login();
}

async function request<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  assertConfigured();
  const token = await getToken();
  const url = new URL(`${BASE}${path}`);
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }

  const { query: _q, headers, ...rest } = init;
  let response = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    cache: "no-store",
  });

  // One re-login if the token was revoked mid-flight.
  if (response.status === 401) {
    tokenCache = null;
    const fresh = await login();
    response = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fresh}`,
        ...headers,
      },
      cache: "no-store",
    });
  }

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const message =
      (payload as { message?: string }).message ||
      (payload as { error?: string }).error ||
      `Shiprocket ${path} failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return payload as T;
}

export function parseShiprocketDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ISO / "2023-05-23 15:40:19"
  const isoish = trimmed.replace(" ", "T");
  const direct = new Date(isoish);
  if (!Number.isNaN(direct.getTime())) return direct;

  // "Jul 05, 2024"
  const named = new Date(trimmed);
  if (!Number.isNaN(named.getTime())) return named;

  // "23 05 2023 11:43:52"
  const m = trimmed.match(
    /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/,
  );
  if (m) {
    const [, dd, mm, yyyy, hh = "0", min = "0", ss = "0"] = m;
    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss),
    );
  }

  return null;
}

/** Maps Shiprocket status text / ids onto our ShipmentStatus enum. */
export function mapShiprocketStatus(
  statusText: string | null | undefined,
  statusId?: number | null,
): ShipmentStatus {
  const text = (statusText ?? "").toUpperCase();

  if (text.includes("UNDELIVERED") || text.includes("FAILED ATTEMPT")) {
    return "FAILED_ATTEMPT";
  }
  if (text.includes("RTO") || text.includes("RETURN TO ORIGIN")) {
    return "RETURNED_TO_ORIGIN";
  }
  if (text.includes("CANCEL")) return "CANCELLED";
  if (text.includes("DELIVERED") || statusId === 7 || statusId === 8) {
    return "DELIVERED";
  }
  if (text.includes("OUT FOR DELIVERY") || text.includes("OFD") || statusId === 17) {
    return "OUT_FOR_DELIVERY";
  }
  if (
    text.includes("PICKED UP") ||
    text.includes("PICKED") ||
    statusId === 6 ||
    statusId === 42
  ) {
    return "PICKED_UP";
  }
  if (text.includes("LABEL") || text.includes("MANIFEST") || text.includes("AWB ASSIGNED")) {
    return "LABEL_CREATED";
  }
  if (
    text.includes("IN TRANSIT") ||
    text.includes("SHIPPED") ||
    statusId === 18 ||
    statusId === 20
  ) {
    return "IN_TRANSIT";
  }

  return "IN_TRANSIT";
}

export function trackingUrlForAwb(awb: string) {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
}

export async function checkServiceability(input: {
  deliveryPincode: string;
  weightKg?: number;
  cod?: boolean;
}): Promise<ServiceabilityOption[]> {
  const pickup = env.SHIPROCKET_PICKUP_PINCODE.replace(/\D/g, "").slice(0, 6);
  const delivery = input.deliveryPincode.replace(/\D/g, "").slice(0, 6);
  if (pickup.length !== 6 || delivery.length !== 6) {
    throw new Error("Enter a valid 6-digit PIN code.");
  }

  const payload = await request<{
    data?: {
      available_courier_companies?: Array<{
        courier_company_id: number;
        courier_name: string;
        rate: number;
        etd?: string;
        estimated_delivery_days?: string | number;
      }>;
    };
    message?: string;
  }>("/courier/serviceability/", {
    query: {
      pickup_postcode: pickup,
      delivery_postcode: delivery,
      cod: input.cod ? 1 : 0,
      weight: input.weightKg ?? 0.2,
    },
  });

  const companies = payload.data?.available_courier_companies ?? [];
  return companies
    .map((c) => {
      const days =
        c.estimated_delivery_days === undefined || c.estimated_delivery_days === ""
          ? null
          : Number(c.estimated_delivery_days);
      return {
        courierId: c.courier_company_id,
        courierName: c.courier_name,
        rate: c.rate,
        etd: c.etd ?? null,
        etdDate: parseShiprocketDate(c.etd),
        estimatedDays: Number.isFinite(days) ? days : null,
      };
    })
    .sort((a, b) => a.rate - b.rate);
}

export async function createAdhocOrder(body: Record<string, unknown>) {
  return request<{
    order_id: number;
    shipment_id: number;
    status: string;
    status_code: number;
  }>("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function assignAwb(shipmentId: number, courierId: number) {
  return request<{
    awb_assign_status?: number;
    response?: {
      data?: {
        awb_code?: string;
        courier_name?: string;
        courier_company_id?: number;
        assigned_date_time?: { date?: string };
      };
    };
    // Some accounts return a flatter shape.
    awb_code?: string;
    courier_name?: string;
  }>("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify({
      shipment_id: shipmentId,
      courier_id: courierId,
    }),
  });
}

export async function requestPickup(shipmentIds: number[]) {
  return request<{ pickup_status?: number; response?: unknown }>(
    "/courier/generate/pickup",
    {
      method: "POST",
      body: JSON.stringify({ shipment_id: shipmentIds }),
    },
  );
}

export async function trackByAwb(awb: string): Promise<TrackingSnapshot | null> {
  const payload = await request<{
    tracking_data?: {
      track_status?: number;
      error?: string;
      shipment_status?: number | string;
      shipment_track?: Array<{
        awb_code?: string;
        courier_name?: string;
        current_status?: string;
        edd?: string;
        etd?: string;
      }>;
      shipment_track_activities?: Array<{
        date?: string;
        status?: string;
        activity?: string;
        location?: string;
        "sr-status-label"?: string;
      }>;
      etd?: string;
    };
  }>(`/courier/track/awb/${encodeURIComponent(awb)}`);

  const data = payload.tracking_data;
  if (!data || data.error || !data.shipment_track?.length) return null;

  const head = data.shipment_track[0];
  const statusText = head.current_status ?? String(data.shipment_status ?? "");
  const statusId =
    typeof data.shipment_status === "number" ? data.shipment_status : null;

  const scans = (data.shipment_track_activities ?? [])
    .map((scan) => ({
      occurredAt: parseShiprocketDate(scan.date) ?? new Date(),
      activity: scan.activity || scan.status || "Update",
      location: scan.location || null,
      statusLabel: scan["sr-status-label"] || scan.status || null,
    }))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  return {
    awb: head.awb_code || awb,
    courierName: head.courier_name ?? null,
    currentStatus: statusText || null,
    etd: parseShiprocketDate(data.etd || head.etd || head.edd),
    status: mapShiprocketStatus(statusText, statusId),
    scans,
    trackingUrl: trackingUrlForAwb(head.awb_code || awb),
  };
}

/**
 * Full create → cheapest courier AWB → pickup. Returns everything needed to call
 * shipOrder() and persist provider ids.
 */
export async function createForwardShipment(input: {
  orderNumber: string;
  orderDate: Date;
  email: string;
  phone: string;
  address: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  items: Array<{
    name: string;
    sku: string;
    units: number;
    sellingPriceRupees: number;
  }>;
  subTotalRupees: number;
  shippingChargesRupees?: number;
  weightGrams?: number | null;
}): Promise<CreatedShipment> {
  const phone = input.phone.replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) {
    throw new Error("Customer phone must be a 10-digit Indian mobile number.");
  }

  const nameParts = input.address.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "";
  const weightKg = Math.max((input.weightGrams ?? 200) / 1000, 0.05);
  const pincode = Number(input.address.postalCode.replace(/\D/g, "").slice(0, 6));

  const created = await createAdhocOrder({
    order_id: input.orderNumber,
    order_date: formatShiprocketDateTime(input.orderDate),
    pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: input.address.line1,
    billing_address_2: input.address.line2 ?? "",
    billing_city: input.address.city,
    billing_pincode: pincode,
    billing_state: input.address.state,
    billing_country: input.address.country || "India",
    billing_email: input.email,
    billing_phone: Number(phone),
    shipping_is_billing: true,
    order_items: input.items.map((item) => ({
      name: item.name.slice(0, 200),
      sku: item.sku.slice(0, 50) || "SKU",
      units: item.units,
      selling_price: item.sellingPriceRupees,
    })),
    payment_method: "Prepaid",
    shipping_charges: input.shippingChargesRupees ?? 0,
    sub_total: input.subTotalRupees,
    length: 12,
    breadth: 10,
    height: 4,
    weight: weightKg,
  });

  const options = await checkServiceability({
    deliveryPincode: String(pincode),
    weightKg,
    cod: false,
  });
  if (!options.length) {
    throw new Error("No Shiprocket courier is serviceable for this PIN code.");
  }

  // Prefer the cheapest serviceable courier; jewellery parcels are light.
  const chosen = options[0];
  const assigned = await assignAwb(created.shipment_id, chosen.courierId);
  const awb =
    assigned.response?.data?.awb_code ||
    assigned.awb_code ||
    "";
  if (!awb) {
    throw new Error("Shiprocket created the order but did not return an AWB.");
  }

  try {
    await requestPickup([created.shipment_id]);
  } catch (error) {
    // Pickup can be scheduled later from the panel — AWB is enough to ship.
    console.warn("shiprocket pickup request failed", error);
  }

  const courierName =
    assigned.response?.data?.courier_name ||
    assigned.courier_name ||
    chosen.courierName;

  return {
    shiprocketOrderId: created.order_id,
    shipmentId: created.shipment_id,
    awb,
    courierName,
    etd: chosen.etdDate,
    trackingUrl: trackingUrlForAwb(awb),
    shippingCostPaise: Math.round(chosen.rate * 100),
  };
}

function formatShiprocketDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
