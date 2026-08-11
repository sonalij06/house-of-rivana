"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { submitContactMessage } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

const SUBJECTS = [
  "A question about a piece",
  "Sizing help",
  "An existing order",
  "A commission or custom piece",
  "Something else",
];

export function ContactForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await submitContactMessage({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? "") || undefined,
        subject: String(form.get("subject") ?? "") || undefined,
        message: String(form.get("message") ?? ""),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(result.data.message);
    });
  }

  if (sent) {
    return (
      <motion.div
        className="border border-hairline bg-surface px-6 py-10 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-5" strokeWidth={1.8} />
        </span>
        <p className="mt-4 font-display text-xl text-ink">Message sent</p>
        <p className="mt-2 text-sm text-muted">{sent}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" hint="Optional — helpful for sizing calls">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label="What is this about?" htmlFor="subject">
          <Select id="subject" name="subject" defaultValue={SUBJECTS[0]}>
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Message" htmlFor="message" error={error ?? undefined}>
        <Textarea
          id="message"
          name="message"
          rows={6}
          required
          placeholder="Tell us what you are after — the more detail, the more useful our reply."
        />
      </Field>

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? <Spinner className="size-4" /> : null}
        Send message
      </Button>
    </form>
  );
}
