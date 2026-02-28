"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { conversations } from "@/data/mock";
import {
  Inbox,
  BookUser,
  BarChart3,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/messages", icon: Inbox, label: "メッセージ" },
  { href: "/contacts", icon: BookUser, label: "連絡先" },
  { href: "/reports", icon: BarChart3, label: "レポート" },
  { href: "/settings", icon: Settings, label: "設定" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <aside className="flex h-full w-[60px] shrink-0 flex-col items-center border-r bg-sidebar py-3">
      {/* Logo */}
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
        <span className="text-[10px] font-bold tracking-tight text-background">
          Co
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          const showBadge = item.href === "/messages" && totalUnread > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {showBadge && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[8px] font-bold text-background">
                  {totalUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User avatar */}
      <div className="mt-auto">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[9px] font-semibold text-background">
          田
        </div>
      </div>
    </aside>
  );
}
