import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/auth-forms";
import { BrandLogo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { features } from "@/lib/env";
import { getCurrentUser, isStaff } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (isStaff(user)) redirect("/admin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size={64} framed={false} className="ring-1 ring-cream/20" />
          <p className="mt-4 inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.2em] text-champagne">
            <ShieldCheck className="size-3" />
            Staff sign in
          </p>
        </div>

        <div className="rounded-sm border border-hairline bg-cream px-7 py-8">
          <Suspense fallback={<Skeleton className="h-80 w-full" />}>
            <LoginForm googleEnabled={features.googleAuth} adminMode />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-cream/45">
          Customer accounts sign in{" "}
          <Link href="/login" className="underline hover:text-champagne">
            here
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
