import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LoginForm googleEnabled={features.googleAuth} />
    </Suspense>
  );
}
