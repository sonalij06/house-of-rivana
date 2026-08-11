import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { releaseExpiredHolds } from "@/lib/order-service";

export const dynamic = "force-dynamic";

/**
 * Vercel cron target. Vercel sends `Authorization: Bearer $CRON_SECRET`; we reject
 * anything else so the endpoint cannot be used to cancel orders from outside.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await releaseExpiredHolds();

  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    released: result.released,
    at: new Date().toISOString(),
  });
}
