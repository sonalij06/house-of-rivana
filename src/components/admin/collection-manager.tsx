"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCollection, saveCollection } from "@/app/actions/admin-catalog";
import { DataTable, Panel, StatusPill, Td } from "@/components/admin/primitives";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

export type EditorCollection = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  heroImage: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  productCount: number;
};

export function CollectionManager({ collections }: { collections: EditorCollection[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(collection: EditorCollection) {
    startTransition(async () => {
      const result = await deleteCollection(collection.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${collection.name} deleted.`);
    });
  }

  return (
    <Panel
      title="Collections"
      padded={false}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(editing === "new" ? null : "new")}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          New collection
        </Button>
      }
    >
      <AnimatePresence initial={false}>
        {editing === "new" ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-hairline bg-cream"
          >
            <CollectionForm
              nextSortOrder={collections.length}
              onDone={() => setEditing(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DataTable
        head={["Collection", "Slug", "Pieces", "Placement", ""]}
        empty="No collections yet."
      >
        {collections.flatMap((collection) => {
          const rows = [
            <tr key={collection.id} className={collection.isActive ? undefined : "opacity-55"}>
              <Td>
                <Link
                  href={`/collections/${collection.slug}`}
                  target="_blank"
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {collection.name}
                </Link>
                {collection.subtitle ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {collection.subtitle}
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="font-mono text-[0.6875rem] text-muted">
                  {collection.slug}
                </span>
              </Td>
              <Td>
                <span className="text-xs tabular-nums text-muted">
                  {collection.productCount}
                </span>
              </Td>
              <Td>
                <span className="flex flex-wrap gap-1.5">
                  {collection.isFeatured ? <StatusPill status="CONFIRMED" label="featured" /> : null}
                  {!collection.isActive ? <StatusPill status="EXPIRED" label="hidden" /> : null}
                </span>
              </Td>
              <Td align="right">
                <span className="inline-flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing(editing === collection.id ? null : collection.id)
                    }
                    aria-label={`Edit ${collection.name}`}
                    className="text-muted transition-colors hover:text-gold"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(collection)}
                    disabled={isPending}
                    aria-label={`Delete ${collection.name}`}
                    className="text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.6} />
                  </button>
                </span>
              </Td>
            </tr>,
          ];

          if (editing === collection.id) {
            rows.push(
              <tr key={`${collection.id}-form`}>
                <td colSpan={5} className="bg-cream p-0">
                  <CollectionForm
                    collection={collection}
                    nextSortOrder={collection.sortOrder}
                    onDone={() => setEditing(null)}
                  />
                </td>
              </tr>,
            );
          }

          return rows;
        })}
      </DataTable>
    </Panel>
  );
}

function CollectionForm({
  collection,
  nextSortOrder,
  onDone,
}: {
  collection?: EditorCollection;
  nextSortOrder: number;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(collection?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(collection?.isFeatured ?? false);
  const { fieldErrors, formError, clearErrors, applyFailure } = useFormErrors();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    startTransition(async () => {
      const result = await saveCollection({
        id: collection?.id,
        slug: text("slug"),
        name: text("name"),
        subtitle: text("subtitle") || undefined,
        description: text("description") || undefined,
        heroImage: text("heroImage") || undefined,
        sortOrder: Number(form.get("sortOrder") ?? nextSortOrder),
        isActive,
        isFeatured,
        metaTitle: text("metaTitle") || undefined,
        metaDescription: text("metaDescription") || undefined,
      });

      if (!result.ok) {
        applyFailure(result);
        return;
      }
      toast.success(collection ? "Collection saved." : "Collection created.");
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="border-l-2 border-gold p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={fieldErrors.name}>
          <Input id="name" name="name" defaultValue={collection?.name} required />
        </Field>
        <Field label="Slug" htmlFor="slug" required error={fieldErrors.slug}>
          <Input
            id="slug"
            name="slug"
            defaultValue={collection?.slug}
            placeholder="bridal-edit"
            required
          />
        </Field>
        <Field label="Subtitle" htmlFor="subtitle" error={fieldErrors.subtitle}>
          <Input id="subtitle" name="subtitle" defaultValue={collection?.subtitle ?? ""} />
        </Field>
        <Field
          label="Sort order"
          htmlFor="sortOrder"
          hint="Lower shows first."
          error={fieldErrors.sortOrder}
        >
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={collection?.sortOrder ?? nextSortOrder}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          className="sm:col-span-2"
          error={fieldErrors.description}
        >
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={collection?.description ?? ""}
          />
        </Field>
        <Field
          label="Hero image URL"
          htmlFor="heroImage"
          className="sm:col-span-2"
          hint="Full-bleed banner on the collection page."
          error={fieldErrors.heroImage}
        >
          <Input id="heroImage" name="heroImage" defaultValue={collection?.heroImage ?? ""} />
        </Field>
        <Field label="Meta title" htmlFor="metaTitle" error={fieldErrors.metaTitle}>
          <Input
            id="metaTitle"
            name="metaTitle"
            maxLength={70}
            defaultValue={collection?.metaTitle ?? ""}
          />
        </Field>
        <Field
          label="Meta description"
          htmlFor="metaDescription"
          error={fieldErrors.metaDescription}
        >
          <Input
            id="metaDescription"
            name="metaDescription"
            maxLength={180}
            defaultValue={collection?.metaDescription ?? ""}
          />
        </Field>
      </div>

      {formError ? (
        <p className="mt-4 text-xs text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Spinner className="size-3.5" /> : null}
          {collection ? "Save collection" : "Create collection"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <Checkbox
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Visible
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <Checkbox
            checked={isFeatured}
            onChange={(event) => setIsFeatured(event.target.checked)}
          />
          Feature on the homepage
        </label>
      </div>
    </form>
  );
}
