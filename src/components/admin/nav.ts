import {
  BadgePercent,
  Boxes,
  ClipboardList,
  FileClock,
  Gem,
  Image,
  LayoutDashboard,
  MessageSquareQuote,
  Package,
  Receipt,
  Settings,
  Star,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Only ADMIN sees these; STAFF does not. */
  adminOnly?: boolean;
  /** Key used to fetch a live count badge. */
  badge?: "paymentsToReview" | "reviewsPending" | "lowStock";
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Selling",
    items: [
      { href: "/admin/orders", label: "Orders", icon: Receipt },
      {
        href: "/admin/payments/review",
        label: "Verify payments",
        icon: Wallet,
        badge: "paymentsToReview",
      },
      { href: "/admin/shipments", label: "Shipments", icon: Truck },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Gem },
      { href: "/admin/collections", label: "Collections", icon: Package },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, badge: "lowStock" },
      { href: "/admin/coupons", label: "Coupons", icon: BadgePercent },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      {
        href: "/admin/reviews",
        label: "Reviews",
        icon: Star,
        badge: "reviewsPending",
      },
      { href: "/admin/notifications", label: "Messages", icon: MessageSquareQuote },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/admin/content", label: "Homepage", icon: Image },
      { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
      { href: "/admin/users", label: "Team", icon: ClipboardList, adminOnly: true },
      { href: "/admin/audit-log", label: "Audit log", icon: FileClock, adminOnly: true },
    ],
  },
];
