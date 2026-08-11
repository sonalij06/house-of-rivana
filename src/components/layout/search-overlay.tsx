"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import { formatPaise } from "@/lib/utils";

type Suggestion = {
  slug: string;
  name: string;
  pricePaise: number;
  imageUrl: string | null;
  collection: string | null;
};

const QUICK_LINKS = [
  "Hoops",
  "CZ studs",
  "Bridal",
  "Layering",
  "Kundan",
  "Under ₹1,500",
];

const MIN_QUERY = 2;

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
            onClick={onClose}
            aria-label="Close search"
          />
          {/* Mounted fresh each time, so the query resets without an effect. */}
          <SearchPanel onClose={onClose} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_QUERY;
  // Derived rather than cleared in an effect, so a short query shows nothing
  // even while a stale response is still in state.
  const visible = searchable ? results : [];

  useEffect(() => {
    // Wait for the panel transition before stealing focus.
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { results: Suggestion[] };
          setResults(data.results);
        }
      } catch {
        // Aborted or offline — leaving the previous results is the kinder failure.
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <motion.div
      className="absolute inset-x-0 top-0 border-b border-hairline bg-cream"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="container-site py-6">
        <form onSubmit={submit} className="flex items-center gap-4">
          <Search className="size-5 shrink-0 text-muted" strokeWidth={1.6} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hoops, CZ, bridal…"
            className="h-11 w-full border-0 bg-transparent font-display text-2xl text-ink placeholder:text-muted-light focus:outline-none"
            aria-label="Search products"
          />
          {loading ? <Spinner className="text-muted" /> : null}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted transition-colors hover:text-ink"
            aria-label="Close search"
          >
            <X className="size-4" />
          </button>
        </form>

        {visible.length > 0 ? (
          <ul className="mt-6 grid gap-1 border-t border-hairline pt-4 sm:grid-cols-2">
            {visible.map((item, i) => (
              <motion.li
                key={item.slug}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
              >
                <Link
                  href={`/product/${item.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-4 rounded-xs p-2 transition-colors hover:bg-cream-dark"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden bg-cream-dark">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.collection ? `${item.collection} · ` : ""}
                      {formatPaise(item.pricePaise)}
                    </p>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        ) : searchable && !loading ? (
          <p className="mt-6 border-t border-hairline pt-5 text-sm text-muted">
            Nothing matched “{trimmed}”. Try a metal, a stone, or a collection name.
          </p>
        ) : (
          <div className="mt-6 border-t border-hairline pt-5">
            <p className="eyebrow mb-3">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="rounded-xs border border-hairline px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-champagne hover:text-gold"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
