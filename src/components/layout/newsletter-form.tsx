"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "motion/react";
import { subscribeToNewsletter } from "@/app/actions/contact";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await subscribeToNewsletter(email);
      if (result.ok) {
        setDone(true);
        setEmail("");
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex items-center gap-2 text-sm text-success", className)}
      >
        <Check className="size-4" />
        You are on the list.
      </motion.p>
    );
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className="flex items-center border-b border-ink/25 transition-colors focus-within:border-gold">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          aria-label="Email address"
          className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-muted-light focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex size-10 items-center justify-center text-ink transition-colors hover:text-gold disabled:opacity-50"
          aria-label="Subscribe"
        >
          {isPending ? <Spinner /> : <ArrowRight className="size-4" />}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
