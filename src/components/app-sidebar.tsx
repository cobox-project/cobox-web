"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { conversations } from "@/data/mock";
import {
  Inbox,
  Users,
  BarChart3,
  Settings,
  User,
} from "lucide-react";

const navItems = [
  { href: "/messages", icon: Inbox, label: "メッセージ" },
  { href: "/contacts", icon: Users, label: "顧客" },
  { href: "/reports", icon: BarChart3, label: "レポート" },
  { href: "/settings", icon: Settings, label: "設定" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <aside className="flex h-full w-[60px] shrink-0 flex-col items-center bg-[#111] py-3">
      {/* Logo */}
      <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-white">
        <span className="text-[10px] font-bold tracking-tight text-[#111]">
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
              className={cn(
                "relative flex w-[52px] flex-col items-center gap-0.5 rounded-lg py-2 transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:bg-white/10 hover:text-white/80"
              )}
            >
              <div className="relative">
                <Icon className="h-[18px] w-[18px]" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                    {totalUnread}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-medium leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="mt-auto">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          <User className="h-4 w-4 text-white/70" />
        </div>
      </div>
    </aside>
  );
}
