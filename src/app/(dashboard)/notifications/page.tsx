"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

export default function NotificationsPage() {
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [saved, setSaved] = useState(false);

  const [emailNotif, setEmailNotif] = useState(true);
  const [browserNotif, setBrowserNotif] = useState(false);
  const [newMessage, setNewMessage] = useState(true);
  const [assignNotif, setAssignNotif] = useState(true);
  const [mentionNotif, setMentionNotif] = useState(true);

  const autoSave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setSaved(false);
    saveTimeout.current = setTimeout(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  }, []);

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => {
        onChange(!checked);
        autoSave();
      }}
      className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
        checked ? "bg-brand" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );

  return (
    <div className="flex h-full">
      {/* Layer 2: shared sub navigation */}
      <div className="w-[220px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="mb-4 px-2.5 text-[15px] font-semibold">アカウント</h1>
        <nav className="space-y-0.5">
          <Link
            href="/profile"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[15px] text-muted-foreground hover:bg-accent/50 transition-colors"
          >
            プロフィール
          </Link>
          <Link
            href="/notifications"
            className="flex w-full items-center gap-2.5 rounded-md bg-accent px-2.5 py-[7px] text-[15px] font-medium text-foreground"
          >
            通知
          </Link>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[17px] font-semibold">通知</h2>
            {saved && (
              <span className="text-[13px] text-brand font-medium animate-pulse">
                保存しました
              </span>
            )}
          </div>

          {/* Notification channels */}
          <section className="mb-8">
            <h3 className="text-[15px] font-medium mb-4">通知チャネル</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border px-4 py-4">
                <div>
                  <p className="text-[15px] font-medium">メール通知</p>
                  <p className="text-[13px] text-muted-foreground">重要な通知をメールで受け取る</p>
                </div>
                <Toggle checked={emailNotif} onChange={setEmailNotif} />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-4 py-4">
                <div>
                  <p className="text-[15px] font-medium">ブラウザ通知</p>
                  <p className="text-[13px] text-muted-foreground">デスクトップ通知を有効にする</p>
                </div>
                <Toggle checked={browserNotif} onChange={setBrowserNotif} />
              </div>
            </div>
          </section>

          {/* Notification types */}
          <section>
            <h3 className="text-[15px] font-medium mb-4">通知の種類</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border px-4 py-4">
                <div>
                  <p className="text-[15px] font-medium">新しいメッセージ</p>
                  <p className="text-[13px] text-muted-foreground">新しいメッセージが届いた時</p>
                </div>
                <Toggle checked={newMessage} onChange={setNewMessage} />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-4 py-4">
                <div>
                  <p className="text-[15px] font-medium">アサイン通知</p>
                  <p className="text-[13px] text-muted-foreground">スレッドがアサインされた時</p>
                </div>
                <Toggle checked={assignNotif} onChange={setAssignNotif} />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-4 py-4">
                <div>
                  <p className="text-[15px] font-medium">メンション</p>
                  <p className="text-[13px] text-muted-foreground">チーム内メモでメンションされた時</p>
                </div>
                <Toggle checked={mentionNotif} onChange={setMentionNotif} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
