"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await signOut();
          if (result.error) {
            toast.error(result.error.message ?? "Could not sign out.");
            return;
          }
          router.push("/");
          router.refresh();
        });
      }}
    >
      Sign out
    </Button>
  );
}
