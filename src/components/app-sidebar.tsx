"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { conversations } from "@/data/mock";
import {
  MessageSquare,
  BookUser,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const navItems = [
  { href: "/messages", label: "メッセージ", icon: MessageSquare },
  { href: "/contacts", label: "連絡先", icon: BookUser },
  { href: "/reports", label: "レポート", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex h-13 items-center gap-2.5 px-5">
        <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-foreground">
          <span className="text-[10px] font-bold tracking-tight text-background">
            Co
          </span>
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-foreground">
          Cobox
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 pt-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          const badge =
            item.href === "/messages" && totalUnread > 0
              ? totalUnread
              : null;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-[15px] w-[15px] shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badge && (
                <span className="min-w-[18px] rounded-full bg-foreground px-1.5 py-px text-center text-[10px] font-semibold text-background">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t px-3 py-2 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          <Settings className="h-[15px] w-[15px] shrink-0" />
          <span>設定</span>
        </Link>

        {/* User */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] transition-colors hover:bg-accent/60 cursor-pointer"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[9px] font-semibold text-background">
              田
            </div>
            <span className="flex-1 text-left truncate text-[13px] font-medium text-foreground">
              田中 美咲
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border bg-popover p-1 shadow-md">
              <div className="px-2.5 py-2 border-b mb-1">
                <p className="text-[13px] font-medium">田中 美咲</p>
                <p className="text-[11px] text-muted-foreground">
                  misaki@myshop.jp
                </p>
              </div>
              <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
                <LogOut className="h-3.5 w-3.5" />
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
