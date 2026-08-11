import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/auth-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RegisterForm googleEnabled={features.googleAuth} />
    </Suspense>
  );
}
