"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { currentUser } from "@/data/mock";
import { Avatar } from "@/components/ui/avatar";
import {
  Inbox,
  Users,
  BarChart3,
  Settings,
  X,
  Camera,
} from "lucide-react";

const navItems = [
  { href: "/messages", icon: Inbox, label: "メッセージ" },
  { href: "/contacts", icon: Users, label: "顧客" },
  { href: "/reports", icon: BarChart3, label: "レポート" },
  { href: "/settings", icon: Settings, label: "設定" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col bg-brand py-3 transition-all duration-200",
          expanded ? "w-[180px] items-start px-3" : "w-[60px] items-center"
        )}
      >
        {/* Logo - click to toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mb-6 cursor-pointer"
        >
          <div className={cn(
            "flex items-center gap-2",
            expanded ? "px-1" : ""
          )}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 4C9.37 4 4 9.37 4 16s5.37 12 12 12c2.12 0 4.12-.55 5.86-1.52"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="24" cy="26" r="2" fill="white" fillOpacity="0.6" />
            </svg>
            {expanded && (
              <span className="text-[15px] font-bold tracking-tight text-white">
                Cobox
              </span>
            )}
          </div>
        </button>

        {/* Navigation */}
        <nav className={cn(
          "flex flex-1 flex-col gap-1",
          expanded ? "w-full" : "items-center"
        )}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center rounded-lg transition-colors",
                  expanded
                    ? "gap-2.5 px-3 py-2"
                    : "w-[52px] flex-col gap-0.5 py-2 justify-center",
                  isActive
                    ? "bg-white text-brand"
                    : "text-white/60 hover:bg-white/10 hover:text-white/90"
                )}
              >
                <Icon className={cn(
                  "shrink-0",
                  expanded ? "h-[17px] w-[17px]" : "h-[18px] w-[18px]"
                )} />
                {expanded ? (
                  <span className="text-[13px] font-medium">
                    {item.label}
                  </span>
                ) : (
                  <span className="text-[9px] font-medium leading-tight">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className={cn("mt-auto", expanded ? "w-full" : "")}>
          <button
            onClick={() => setProfileOpen(true)}
            className={cn(
              "cursor-pointer overflow-hidden rounded-full ring-2 ring-white/30 transition-all hover:ring-white/60",
              expanded ? "flex items-center gap-2.5 rounded-lg ring-0 hover:ring-0 w-full px-2 py-1.5 hover:bg-white/10" : ""
            )}
          >
            <Avatar
              src={currentUser.avatar}
              fallback={currentUser.name}
              size="sm"
              className="h-8 w-8"
            />
            {expanded && (
              <span className="text-[12px] font-medium text-white/80 truncate">
                {currentUser.name}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Profile settings modal */}
      {profileOpen && (
        <ProfileSettingsModal onClose={() => setProfileOpen(false)} />
      )}
    </>
  );
}

function ProfileSettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[420px] rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">プロフィール設定</h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Avatar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <Avatar
              src={currentUser.avatar}
              fallback={currentUser.name}
              size="lg"
              className="h-16 w-16"
            />
            <button className="absolute -right-1 -bottom-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-brand text-white shadow-sm">
              <Camera className="h-3 w-3" />
            </button>
          </div>
          <div>
            <p className="text-[14px] font-semibold">{currentUser.name}</p>
            <p className="text-[12px] text-muted-foreground">管理者</p>
          </div>
        </div>

        {/* Form fields - profile only */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
              名前
            </label>
            <input
              defaultValue={currentUser.name}
              className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
              メールアドレス
            </label>
            <input
              defaultValue="misaki.tanaka@myshop.jp"
              className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
              表示名
            </label>
            <input
              defaultValue="美咲"
              className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-accent"
          >
            キャンセル
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand/90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
