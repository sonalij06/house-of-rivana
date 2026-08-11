"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Reorder } from "motion/react";
import { GripVertical, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { removeImage, reorderImages, updateImageAlt, uploadImages } from "@/app/actions/admin-catalog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type EditorImage = {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
};

/**
 * Drag to reorder; the first image is the one the storefront uses on cards and
 * as the PDP hero. Order is persisted on drop rather than on every pointer move.
 */
export function ImageManager({
  productId,
  images: initial,
  storageReady,
}: {
  productId: string;
  images: EditorImage[];
  storageReady: boolean;
}) {
  const [images, setImages] = useState(initial);
  const [altErrors, setAltErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function persistOrder(next: EditorImage[]) {
    startTransition(async () => {
      const result = await reorderImages({
        productId,
        imageIds: next.map((image) => image.id),
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;

    const formData = new FormData();
    formData.set("productId", productId);
    for (const file of files) formData.append("images", file);

    setUploading(true);
    startTransition(async () => {
      const result = await uploadImages(formData);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.added} ${result.data.added === 1 ? "image" : "images"} added.`);
      // The server holds the truth for URLs and blur data; refresh via revalidation.
      window.location.reload();
    });
  }

  function drop(imageId: string) {
    startTransition(async () => {
      const result = await removeImage(imageId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setImages((current) => current.filter((image) => image.id !== imageId));
      toast.success("Image removed.");
    });
  }

  function saveAlt(imageId: string, alt: string) {
    startTransition(async () => {
      const result = await updateImageAlt({ imageId, alt });
      if (!result.ok) {
        const message = result.fieldErrors?.alt ?? result.error;
        setAltErrors((current) => ({ ...current, [imageId]: message }));
        return;
      }
      setAltErrors((current) => {
        const next = { ...current };
        delete next[imageId];
        return next;
      });
      setImages((current) =>
        current.map((image) => (image.id === imageId ? { ...image, alt } : image)),
      );
    });
  }

  return (
    <div>
      {images.length === 0 ? (
        <p className="mb-4 border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">
          No photographs yet. The first one you add becomes the card image.
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={images}
          onReorder={setImages}
          className="mb-4 space-y-2"
        >
          {images.map((image, index) => (
            <Reorder.Item
              key={image.id}
              value={image}
              onDragEnd={() => persistOrder(images)}
              className="flex cursor-grab items-center gap-3 border border-hairline bg-surface p-2.5 active:cursor-grabbing"
            >
              <GripVertical className="size-4 shrink-0 text-muted-light" strokeWidth={1.6} />
              <span className="relative size-14 shrink-0 overflow-hidden bg-cream-dark">
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="56px"
                  className="object-cover"
                  unoptimized
                />
              </span>
              <span className="min-w-0 flex-1">
                <input
                  defaultValue={image.alt}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next !== image.alt) saveAlt(image.id, next);
                  }}
                  aria-label="Alt text"
                  aria-invalid={altErrors[image.id] ? true : undefined}
                  className="w-full bg-transparent text-sm text-ink focus:outline-none aria-invalid:text-danger"
                />
                {altErrors[image.id] ? (
                  <span className="mt-0.5 block text-xs text-danger" role="alert">
                    {altErrors[image.id]}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[0.625rem] uppercase tracking-[0.12em] text-muted-light">
                    {index === 0 ? "Card & hero image" : `Position ${index + 1}`}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => drop(image.id)}
                disabled={isPending}
                aria-label="Remove this image"
                className="shrink-0 text-muted-light transition-colors hover:text-danger"
              >
                <Trash2 className="size-3.5" strokeWidth={1.6} />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFiles}
        className="sr-only"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || !storageReady}
      >
        {uploading ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" strokeWidth={1.6} />}
        Upload photographs
      </Button>
      {!storageReady ? (
        <p className="mt-2 text-xs text-warning">
          Image storage is unavailable. Confirm the database is reachable, then
          restart the dev server.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-light">
          JPEG, PNG or WebP up to 8 MB. Stored in Postgres. Drag the rows to reorder.
        </p>
      )}
    </div>
  );
}
