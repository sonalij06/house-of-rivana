"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { completeSignIn } from "@/app/actions/auth";
import {
  requestPasswordReset,
  resetPassword,
  signIn,
  signUp,
} from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 2.9.7 3.6 1.4l2.4-2.4C16.7 3.9 14.6 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.1-1.5H12z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.6-.1-1-.1-1.5H12v3.6h5.1c-.2 1.1-.9 2.4-1.9 3.1v2.6h3.1c1.8-1.7 2.9-4.2 2.9-7.8z"
        opacity=".85"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14.3A5.4 5.4 0 0 1 6.1 12c0-.8.1-1.6.4-2.3L3.3 7.1A8.9 8.9 0 0 0 3 12c0 1.4.3 2.8.9 4l2.5-1.7z"
      />
      <path
        fill="#34A853"
        d="M12 21c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8L3.9 16A9 9 0 0 0 12 21z"
      />
    </svg>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="relative">
      <Input
        id={inputId}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:text-ink"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="size-4" strokeWidth={1.6} />
        ) : (
          <Eye className="size-4" strokeWidth={1.6} />
        )}
      </button>
    </div>
  );
}

function GoogleButton({ callbackURL }: { callbackURL: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="subtle"
      block
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await signIn.social({ provider: "google", callbackURL });
        })
      }
    >
      {isPending ? <Spinner /> : <GoogleGlyph />}
      Continue with Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-4">
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-[0.625rem] uppercase tracking-[0.16em] text-muted-light">
        or
      </span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="font-display text-4xl leading-tight text-ink"
      >
        {title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3 text-sm text-muted"
      >
        {subtitle}
      </motion.p>
    </div>
  );
}

export function LoginForm({
  googleEnabled,
  adminMode = false,
}: {
  googleEnabled: boolean;
  adminMode?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? (adminMode ? "/admin" : "/account");
  const forbidden = params?.get("error") === "forbidden";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn.email({
        email: email.trim(),
        password,
        rememberMe: remember,
      });

      if (result.error) {
        setError(
          result.error.message ??
            "That email and password combination did not work.",
        );
        return;
      }

      const completion = await completeSignIn();
      if (!completion.ok) {
        setError(completion.error);
        return;
      }

      const role = completion.data.role;
      if (adminMode && role !== "ADMIN" && role !== "STAFF") {
        setError("That account does not have access to the admin area.");
        return;
      }

      toast.success("Welcome back.");
      router.push(next);
      router.refresh();
    });
  }

  return (
    <>
      <Heading
        title={adminMode ? "Admin sign in" : "Welcome back."}
        subtitle={
          adminMode ? (
            "Staff and administrator access only."
          ) : (
            <>
              New here?{" "}
              <Link
                href={`/register?next=${encodeURIComponent(next)}`}
                className="text-ink underline decoration-champagne underline-offset-4 hover:text-gold"
              >
                Create an account
              </Link>
            </>
          )
        }
      />

      {forbidden ? (
        <p className="mb-5 rounded-xs border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Your account does not have permission to view the admin area.
        </p>
      ) : null}

      {googleEnabled && !adminMode ? (
        <>
          <GoogleButton callbackURL={next} />
          <Divider />
        </>
      ) : null}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="password" required error={error}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
        </Field>

        <div className="flex items-center justify-between gap-4 pt-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted">
            <Checkbox
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Keep me signed in
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted underline underline-offset-4 hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" block disabled={isPending} className="mt-2">
          {isPending ? <Spinner /> : null}
          Sign in
        </Button>
      </form>
    </>
  );
}

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "/account";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    marketingOptIn: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("Use at least eight characters.");
      return;
    }

    startTransition(async () => {
      const result = await signUp.email({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        // Extra fields are declared in the Better Auth config; role is not
        // accepted from the client, so a signup can never self-promote.
        phone: form.phone.trim() || undefined,
        marketingOptIn: form.marketingOptIn,
      });

      if (result.error) {
        setError(
          result.error.message ?? "We could not create that account.",
        );
        return;
      }

      await completeSignIn();
      toast.success("Account created.");
      router.push(next);
      router.refresh();
    });
  }

  return (
    <>
      <Heading
        title="Create your account."
        subtitle={
          <>
            Already with us?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="text-ink underline decoration-champagne underline-offset-4 hover:text-gold"
            >
              Sign in
            </Link>
          </>
        }
      />

      {googleEnabled ? (
        <>
          <GoogleButton callbackURL={next} />
          <Divider />
        </>
      ) : null}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" required>
          <Input
            id="name"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Ananya Rao"
          />
        </Field>

        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Phone"
          htmlFor="phone"
          hint="For delivery updates on WhatsApp. Optional."
        >
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+91 98765 43210"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          error={error}
          hint="At least eight characters."
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(value) => update("password", value)}
            placeholder="••••••••"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs leading-relaxed text-muted">
          <Checkbox
            className="mt-0.5"
            checked={form.marketingOptIn}
            onChange={(e) => update("marketingOptIn", e.target.checked)}
          />
          Send me new arrivals and restocks. Two emails a month, never more.
        </label>

        <Button type="submit" block disabled={isPending} className="mt-2">
          {isPending ? <Spinner /> : null}
          Create account
        </Button>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Try again.");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <>
        <div className="mb-6 flex size-11 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-5" />
        </div>
        <Heading
          title="Check your inbox."
          subtitle={`If an account exists for ${email.trim()}, a reset link is on its way. It expires in one hour.`}
        />
        <Button asChild variant="subtle" block>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Heading
        title="Reset your password."
        subtitle="Tell us the email on your account and we will send a link."
      />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" required error={error}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Button type="submit" block disabled={isPending}>
          {isPending ? <Spinner /> : null}
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">
        <Link href="/login" className="underline underline-offset-4 hover:text-ink">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least eight characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(
          result.error.message ??
            "That link has expired. Request a new one and try again.",
        );
        return;
      }
      toast.success("Password updated. You can sign in now.");
      router.push("/login");
    });
  }

  if (!token) {
    return (
      <>
        <Heading
          title="This link is incomplete."
          subtitle="Reset links can only be opened from the email we sent. Request a fresh one."
        />
        <Button asChild block>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Heading
        title="Choose a new password."
        subtitle="Make it something you are not using anywhere else."
      />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" required>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={setPassword}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" required error={error}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={setConfirm}
          />
        </Field>
        <Button type="submit" block disabled={isPending}>
          {isPending ? <Spinner /> : null}
          Update password
        </Button>
      </form>
    </>
  );
}
