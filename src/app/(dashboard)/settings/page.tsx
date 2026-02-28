"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { accounts, teamMembers } from "@/data/mock";
import type { Channel } from "@/data/types";
import { Button } from "@/components/ui/button";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  Link2,
  Users,
  Bell,
  Sliders,
  Plus,
  Trash2,
  Shield,
} from "lucide-react";

const tabs = [
  { id: "accounts", label: "アカウント接続", icon: Link2 },
  { id: "team", label: "チーム", icon: Users },
  { id: "notifications", label: "通知", icon: Bell },
  { id: "general", label: "全般", icon: Sliders },
] as const;

type TabId = (typeof tabs)[number]["id"];

const channelIcons: Record<Channel, React.ElementType> = {
  instagram: Instagram,
  line: MessageCircle,
  email: Mail,
  facebook: Facebook,
};

const channelLabels: Record<Channel, string> = {
  instagram: "Instagram",
  line: "LINE",
  email: "Email",
  facebook: "Facebook",
};

const channelStyles: Record<Channel, { bg: string; text: string }> = {
  instagram: { bg: "bg-channel-instagram/10", text: "text-channel-instagram" },
  line: { bg: "bg-channel-line/10", text: "text-channel-line" },
  email: { bg: "bg-channel-email/10", text: "text-channel-email" },
  facebook: { bg: "bg-channel-facebook/10", text: "text-channel-facebook" },
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("accounts");

  return (
    <div className="flex h-full">
      {/* Settings nav (second column) */}
      <div className="w-[200px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="px-2.5 text-[15px] font-semibold mb-4">設定</h1>
        <nav className="space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors cursor-pointer",
                  activeTab === tab.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon className="h-[15px] w-[15px] shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings content (third column) */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-8 py-6">
          {activeTab === "accounts" && <AccountsSettings />}
          {activeTab === "team" && <TeamSettings />}
          {activeTab === "notifications" && <NotificationsSettings />}
          {activeTab === "general" && <GeneralSettings />}
        </div>
      </div>
    </div>
  );
}

function AccountsSettings() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold">アカウント接続</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            メッセージを受信するアカウントを管理
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-[12px] h-7">
          <Plus className="h-3 w-3" />
          追加
        </Button>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => {
          const Icon = channelIcons[account.channel];
          const s = channelStyles[account.channel];
          return (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg",
                  s.bg
                )}
              >
                <Icon className={cn("h-4 w-4", s.text)} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium">{account.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {channelLabels[account.channel]} ・ {account.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-status-resolved/10 px-2 py-0.5 text-[10px] font-medium text-status-resolved">
                  接続中
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">
          追加可能
        </p>
        <div className="space-y-1.5">
          {(["facebook"] as Channel[]).map((channel) => {
            const Icon = channelIcons[channel];
            const s = channelStyles[channel];
            return (
              <div
                key={channel}
                className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    s.bg
                  )}
                >
                  <Icon className={cn("h-4 w-4", s.text)} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium">
                    {channelLabels[channel]}
                  </p>
                  <p className="text-[11px] text-muted-foreground">未接続</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7"
                >
                  接続する
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamSettings() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold">チーム</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            チームメンバーと権限を管理
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-[12px] h-7">
          <Plus className="h-3 w-3" />
          招待
        </Button>
      </div>

      <div className="rounded-lg border">
        {teamMembers.map((member, i) => (
          <div
            key={member.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              i < teamMembers.length - 1 && "border-b"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">
              {member.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium">{member.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {member.id === "u1" && (
                <span className="flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Shield className="h-2.5 w-2.5" />
                  管理者
                </span>
              )}
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                メンバー
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsSettings() {
  return (
    <div>
      <h2 className="text-[15px] font-semibold mb-1">通知</h2>
      <p className="text-[12px] text-muted-foreground mb-4">
        通知の受信方法を設定
      </p>

      <div className="space-y-3">
        {[
          {
            title: "新着メッセージ",
            desc: "新しいメッセージを受信したとき",
          },
          {
            title: "アサイン通知",
            desc: "会話が自分にアサインされたとき",
          },
          {
            title: "社内メモ",
            desc: "担当会話に社内メモが追加されたとき",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div>
              <p className="text-[13px] font-medium">{item.title}</p>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
            <ToggleSwitch defaultOn />
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div>
      <h2 className="text-[15px] font-semibold mb-1">全般</h2>
      <p className="text-[12px] text-muted-foreground mb-4">
        アプリケーション全般の設定
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-medium text-muted-foreground">
            ワークスペース名
          </label>
          <input
            defaultValue="My Shop"
            className="mt-1 w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-foreground/20"
          />
        </div>
        <div>
          <label className="text-[12px] font-medium text-muted-foreground">
            タイムゾーン
          </label>
          <input
            defaultValue="Asia/Tokyo (UTC+9)"
            disabled
            className="mt-1 w-full rounded-md border bg-accent/30 px-3 py-2 text-[13px] text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
        on ? "bg-foreground" : "bg-input"
      )}
    >
      <div
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform shadow-sm",
          on ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
