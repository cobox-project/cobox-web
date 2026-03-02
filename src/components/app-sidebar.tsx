"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { currentUser } from "@/data/mock";
import { Avatar } from "@/components/ui/avatar";
import {
  Inbox,
  Users,
  BarChart3,
  Settings,
  LogOut,
  User,
  Bell,
  Globe,
  ChevronRight,
  LifeBuoy,
} from "lucide-react";

const navItems = [
  { href: "/messages", icon: Inbox, label: "メッセージ", letterSpacing: "-1px" },
  { href: "/contacts", icon: Users, label: "連絡先" },
  { href: "/reports", icon: BarChart3, label: "レポート" },
  { href: "/settings", icon: Settings, label: "管理", adminOnly: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [langSubmenuOpen, setLangSubmenuOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser.role === "admin";

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        setLangSubmenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col items-center bg-brand px-2 py-4">
      {/* Logo */}
      <div className="mb-7 flex items-center justify-center">
        <span className="text-[15px] font-black tracking-[0] text-white leading-none select-none">
          Cobox
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname.startsWith(item.href) ||
              (item.href === "/settings" && pathname.startsWith("/settings"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex w-[60px] flex-col items-center justify-center gap-0.5 rounded-lg py-2.5 transition-colors",
                  isActive
                    ? "bg-white text-brand"
                    : "text-white hover:bg-white/10"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span
                  className="text-[12px] font-medium leading-tight"
                  style={item.letterSpacing ? { letterSpacing: item.letterSpacing } : undefined}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
      </nav>

      {/* User profile */}
      <div className="relative mt-auto" ref={popoverRef}>
        <button
          onClick={() => {
            setPopoverOpen(!popoverOpen);
            setLangSubmenuOpen(false);
          }}
          className="cursor-pointer overflow-hidden rounded-full ring-2 ring-white/30 transition-all hover:ring-white/60"
        >
          <Avatar
            src={currentUser.avatar}
            fallback={currentUser.name}
            size="sm"
            className="h-9 w-9"
          />
        </button>

        {/* Profile popover */}
        {popoverOpen && (
          <div className="absolute bottom-[calc(100%+12px)] left-0 z-[200] w-[240px] rounded-xl bg-background shadow-xl border">
            {/* User info */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Avatar
                src={currentUser.avatar}
                fallback={currentUser.name}
                size="sm"
                className="h-10 w-10"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold truncate">{currentUser.name}</p>
                <p className="text-[12px] text-muted-foreground truncate">misaki.tanaka@myshop.jp</p>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <button
                onClick={() => {
                  setPopoverOpen(false);
                  router.push("/profile");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                プロフィール
              </button>
              <button
                onClick={() => {
                  setPopoverOpen(false);
                  router.push("/notifications");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                通知
              </button>

              {/* Language with submenu */}
              <div
                className="relative"
                onMouseEnter={() => setLangSubmenuOpen(true)}
                onMouseLeave={() => setLangSubmenuOpen(false)}
              >
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">言語</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {langSubmenuOpen && (
                  <div className="absolute left-full top-0 ml-1 w-[160px] rounded-lg bg-background shadow-xl border py-1 z-[210]">
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] bg-accent/50 font-medium cursor-pointer hover:bg-accent transition-colors"
                    >
                      日本語
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] text-muted-foreground cursor-pointer hover:bg-accent transition-colors"
                    >
                      English
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] text-muted-foreground cursor-pointer hover:bg-accent transition-colors"
                    >
                      中文
                    </button>
                  </div>
                )}
              </div>

              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                サポート
              </button>
            </div>

            {/* Logout */}
            <div className="border-t py-1">
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] text-destructive hover:bg-accent transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
