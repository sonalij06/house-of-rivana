import { AccountNav } from "@/components/account/account-nav";
import { requireUser } from "@/lib/session";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/account");

  return (
    <div className="container-site py-12 md:py-16">
      <AccountNav />
      <div className="mt-10">{children}</div>
    </div>
  );
}
