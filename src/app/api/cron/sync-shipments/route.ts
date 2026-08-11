import { NextResponse } from "next/server";
import { env, features } from "@/lib/env";
import { syncOpenShipments } from "@/lib/shipping/sync";

export const dynamic = "force-dynamic";

/** Polls Shiprocket for open AWBs so tracking stays fresh even without webhooks. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!features.shiprocket) {
    return NextResponse.json({ ok: true, skipped: true, reason: "shiprocket inactive" });
  }

  const result = await syncOpenShipments();
  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    updated: result.updated,
    errors: result.errors.slice(0, 5),
    at: new Date().toISOString(),
  });
}
