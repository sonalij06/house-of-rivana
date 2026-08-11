import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** Streams a StoredImage row. Public on purpose — product photography is CDN-like. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const image = await prisma.storedImage.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, byteSize: true },
  });

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = Buffer.isBuffer(image.bytes)
    ? image.bytes
    : Buffer.from(image.bytes);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.byteSize),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
