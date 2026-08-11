"use client";

import { useRef, useState, useTransition } from "react";
import { AnimatePresence, Reorder, motion } from "motion/react";
import { GripVertical, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  deleteHeroSlide,
  reorderHeroSlides,
  saveHeroSlide,
  uploadHeroImage,
} from "@/app/actions/admin-content";
import { Panel } from "@/components/admin/primitives";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";

export type EditorSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  alignment: string;
  sortOrder: number;
  isActive: boolean;
};

export function HeroEditor({ slides }: { slides: EditorSlide[] }) {
  const [order, setOrder] = useState(slides);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [isPending, startTransition] = useTransition();

  function persistOrder(next: EditorSlide[]) {
    setOrder(next);
    startTransition(async () => {
      const result = await reorderHeroSlides(next.map((slide) => slide.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove(slide: EditorSlide) {
    startTransition(async () => {
      const result = await deleteHeroSlide(slide.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOrder((current) => current.filter((item) => item.id !== slide.id));
      toast.success("Slide removed.");
    });
  }

  return (
    <Panel
      title="Hero slides"
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(editing === "new" ? null : "new")}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Add slide
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted">
        The homepage hero cycles through these in order. Drag to rearrange — the first
        active slide is what a first-time visitor sees.
      </p>

      <AnimatePresence initial={false}>
        {editing === "new" ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="border border-hairline bg-cream">
              <SlideForm
                nextSortOrder={order.length}
                onDone={() => setEditing(null)}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {order.length === 0 ? (
        <p className="border border-dashed border-hairline px-5 py-10 text-center text-sm text-muted">
          No slides yet. The homepage falls back to a still image until you add one.
        </p>
      ) : (
        <Reorder.Group axis="y" values={order} onReorder={persistOrder} className="space-y-3">
          {order.map((slide) => (
            <Reorder.Item key={slide.id} value={slide} className="list-none">
              <div
                className={
                  slide.isActive
                    ? "border border-hairline bg-surface"
                    : "border border-hairline bg-surface opacity-55"
                }
              >
                <div className="flex items-center gap-3 p-3">
                  <span className="cursor-grab text-muted-light active:cursor-grabbing">
                    <GripVertical className="size-4" strokeWidth={1.6} />
                  </span>
                  <span className="relative h-14 w-24 shrink-0 overflow-hidden bg-cream-dark">
                    <SafeImage
                      src={slide.imageUrl}
                      alt={slide.title}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    {slide.eyebrow ? (
                      <span className="block text-[0.5625rem] uppercase tracking-[0.18em] text-muted-light">
                        {slide.eyebrow}
                      </span>
                    ) : null}
                    <span className="block truncate font-display text-lg leading-tight text-ink">
                      {slide.title}
                    </span>
                    {slide.ctaLabel ? (
                      <span className="block text-[0.625rem] text-muted-light">
                        {slide.ctaLabel} → {slide.ctaHref ?? "/shop"}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(editing === slide.id ? null : slide.id)}
                    className="text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
                  >
                    {editing === slide.id ? "Close" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(slide)}
                    disabled={isPending}
                    aria-label={`Delete ${slide.title}`}
                    className="text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.6} />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {editing === slide.id ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-hairline bg-cream"
                    >
                      <SlideForm
                        slide={slide}
                        nextSortOrder={slide.sortOrder}
                        onDone={() => setEditing(null)}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
    </Panel>
  );
}

function SlideForm({
  slide,
  nextSortOrder,
  onDone,
}: {
  slide?: EditorSlide;
  nextSortOrder: number;
  onDone: () => void;
}) {
  const [imageUrl, setImageUrl] = useState(slide?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(slide?.isActive ?? true);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { fieldErrors, formError, clearErrors, applyFailure } = useFormErrors();

  function upload(file: File) {
    setIsUploading(true);
    const body = new FormData();
    body.set("image", file);
    startTransition(async () => {
      const result = await uploadHeroImage(body);
      setIsUploading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setImageUrl(result.data.url);
      toast.success("Image uploaded.");
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    startTransition(async () => {
      const result = await saveHeroSlide({
        id: slide?.id,
        eyebrow: text("eyebrow") || undefined,
        title: text("title"),
        subtitle: text("subtitle") || undefined,
        imageUrl,
        ctaLabel: text("ctaLabel") || undefined,
        ctaHref: text("ctaHref") || undefined,
        alignment: text("alignment") as "left" | "center" | "right",
        sortOrder: nextSortOrder,
        isActive,
      });

      if (!result.ok) {
        applyFailure(result);
        return;
      }
      toast.success(slide ? "Slide saved." : "Slide added.");
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Eyebrow"
          htmlFor="eyebrow"
          hint="Small line above the headline."
          error={fieldErrors.eyebrow}
        >
          <Input id="eyebrow" name="eyebrow" defaultValue={slide?.eyebrow ?? ""} />
        </Field>
        <Field label="Alignment" htmlFor="alignment" error={fieldErrors.alignment}>
          <Select id="alignment" name="alignment" defaultValue={slide?.alignment ?? "center"}>
            <option value="left">Left</option>
            <option value="center">Centre</option>
            <option value="right">Right</option>
          </Select>
        </Field>
        <Field
          label="Headline"
          htmlFor="title"
          required
          className="sm:col-span-2"
          error={fieldErrors.title}
        >
          <Input id="title" name="title" defaultValue={slide?.title} required />
        </Field>
        <Field
          label="Subtitle"
          htmlFor="subtitle"
          className="sm:col-span-2"
          error={fieldErrors.subtitle}
        >
          <Textarea
            id="subtitle"
            name="subtitle"
            rows={2}
            defaultValue={slide?.subtitle ?? ""}
          />
        </Field>
        <Field label="Button label" htmlFor="ctaLabel" error={fieldErrors.ctaLabel}>
          <Input
            id="ctaLabel"
            name="ctaLabel"
            defaultValue={slide?.ctaLabel ?? ""}
            placeholder="Explore the collection"
          />
        </Field>
        <Field label="Button link" htmlFor="ctaHref" error={fieldErrors.ctaHref}>
          <Input
            id="ctaHref"
            name="ctaHref"
            defaultValue={slide?.ctaHref ?? ""}
            placeholder="/collections/bridal-edit"
          />
        </Field>
      </div>

      <div className="mt-4 border-t border-hairline pt-4">
        <div className="flex flex-wrap items-start gap-4">
          <span className="relative h-24 w-40 shrink-0 overflow-hidden border border-hairline bg-cream-dark">
            {imageUrl ? (
              <SafeImage
                src={imageUrl}
                alt="Slide preview"
                fill
                sizes="160px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-[0.625rem] uppercase tracking-[0.14em] text-muted-light">
                No image
              </span>
            )}
          </span>
          <div className="min-w-48 flex-1">
            <Field label="Image URL" htmlFor="imageUrl" error={fieldErrors.imageUrl}>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://…"
              />
            </Field>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={isUploading}
              onClick={() => fileInput.current?.click()}
            >
              {isUploading ? (
                <Spinner className="size-3.5" />
              ) : (
                <Upload className="size-3.5" strokeWidth={1.8} />
              )}
              Upload
            </Button>
          </div>
        </div>
      </div>

      {formError ? (
        <p className="mt-4 text-xs text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button type="submit" size="sm" disabled={isPending || !imageUrl}>
          {isPending && !isUploading ? <Spinner className="size-3.5" /> : null}
          {slide ? "Save slide" : "Add slide"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <Checkbox
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Show on the homepage
        </label>
      </div>
    </form>
  );
}
