"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { conversations, currentUser, teamMembers } from "@/data/mock";
import { Avatar } from "@/components/ui/avatar";
import {
  Inbox,
  Users,
  BarChart3,
  Settings,
  X,
  Camera,
  Bell,
  Palette,
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
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <aside className="flex h-full w-[60px] shrink-0 flex-col items-center bg-brand py-3">
        {/* Logo */}
        <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
              fill="white"
              fillOpacity="0.9"
            />
            <path
              d="M8 12.5C8 10.01 10.01 8 12.5 8H14c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2h-1.5C11.12 13 10 14.12 10 15.5V16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-brand"
            />
            <circle cx="10" cy="18" r="1.2" fill="currentColor" className="text-brand" />
          </svg>
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
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white/90"
                )}
              >
                <div className="relative">
                  <Icon className="h-[18px] w-[18px]" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[8px] font-bold text-brand">
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

        {/* User profile */}
        <div className="mt-auto">
          <button
            onClick={() => setProfileOpen(true)}
            className="cursor-pointer overflow-hidden rounded-full ring-2 ring-white/30 transition-all hover:ring-white/60"
          >
            <Avatar
              src={currentUser.avatar}
              fallback={currentUser.name}
              size="sm"
              className="h-8 w-8"
            />
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

        {/* Form fields */}
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

          {/* Notification settings */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[13px]">通知設定</span>
            </div>
            <span className="text-[11px] text-muted-foreground">オン</span>
          </div>

          {/* Theme color */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[13px]">テーマカラー</span>
            </div>
            <div className="h-5 w-5 rounded-full bg-brand" />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <span className="text-[13px]">ステータス表示</span>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              オンライン
            </span>
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
