"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { currentUser } from "@/data/mock";
import { Avatar } from "@/components/ui/avatar";
import { Camera, User, Bell } from "lucide-react";

export default function ProfilePage() {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState("misaki.tanaka@myshop.jp");
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [saved, setSaved] = useState(false);

  const autoSave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setSaved(false);
    saveTimeout.current = setTimeout(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        autoSave();
      }
    };
    reader.readAsDataURL(file);
  }, [autoSave]);

  return (
    <div className="flex h-full">
      {/* Layer 2: shared sub navigation */}
      <div className="w-[220px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="mb-4 px-2.5 text-[15px] font-semibold">アカウント</h1>
        <nav className="space-y-0.5">
          <Link
            href="/profile"
            className="flex w-full items-center gap-2.5 rounded-md bg-accent px-2.5 py-[7px] text-[15px] font-medium text-foreground"
          >
            <User className="h-[16px] w-[16px] shrink-0" />
            プロフィール
          </Link>
          <Link
            href="/notifications"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[15px] text-muted-foreground hover:bg-accent/50 transition-colors"
          >
            <Bell className="h-[16px] w-[16px] shrink-0" />
            通知
          </Link>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[17px] font-semibold">プロフィール</h2>
            {saved && (
              <span className="text-[13px] text-brand font-medium animate-pulse">
                保存しました
              </span>
            )}
          </div>

          {/* Avatar */}
          <div className="mb-8 flex items-center gap-4">
            <div className="relative">
              <Avatar
                src={avatarUrl}
                fallback={currentUser.name}
                size="lg"
                className="h-20 w-20"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -right-1 -bottom-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-brand text-white shadow-sm hover:bg-brand/90 transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div>
              <p className="text-[16px] font-semibold">{currentUser.name}</p>
              <p className="text-[13px] text-muted-foreground">管理者</p>
            </div>
          </div>

          {/* Form fields - auto save */}
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                名前
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  autoSave();
                }}
                className="w-full rounded-md border px-3 py-3 text-[15px] outline-none focus:border-brand/40 transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                メールアドレス
              </label>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  autoSave();
                }}
                className="w-full rounded-md border px-3 py-3 text-[15px] outline-none focus:border-brand/40 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
