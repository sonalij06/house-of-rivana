"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const FALLBACK = "/placeholders/fallback.svg";

/**
 * next/image with a graceful fallback. Product photography is uploaded by staff,
 * so a missing or moved object should degrade to brand art rather than a broken
 * icon in the middle of a collection grid.
 */
export function SafeImage({
  src,
  alt,
  ...props
}: Omit<ImageProps, "src"> & { src: string | null | undefined }) {
  const [failed, setFailed] = useState(false);
  const resolved = failed || !src ? FALLBACK : src;

  return (
    <Image
      src={resolved}
      alt={alt}
      onError={() => setFailed(true)}
      unoptimized={resolved.endsWith(".svg")}
      {...props}
    />
  );
}
