"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { accounts, teamMembers, currentUser } from "@/data/mock";
import type { Channel } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  Link2,
  Users,
  User,
  Plus,
  Trash2,
  Shield,
  Pencil,
  Camera,
} from "lucide-react";

const tabs = [
  { id: "profile", label: "プロフィール", icon: User },
  { id: "accounts", label: "アカウント接続", icon: Link2 },
  { id: "team", label: "チーム", icon: Users },
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
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  return (
    <div className="flex h-full">
      {/* Layer 2: Settings nav (220px) */}
      <div className="w-[220px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="mb-4 px-2.5 text-[15px] font-semibold">設定</h1>

        <div className="mb-3">
          <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            個人
          </p>
          <nav className="space-y-0.5">
            {tabs.filter((t) => t.id === "profile").map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors cursor-pointer",
                    activeTab === tab.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-[15px] w-[15px] shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            チーム
          </p>
          <nav className="space-y-0.5">
            {tabs.filter((t) => t.id !== "profile").map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors cursor-pointer",
                    activeTab === tab.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-[15px] w-[15px] shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-8 py-6">
          {activeTab === "profile" && <ProfileSettings />}
          {activeTab === "accounts" && <AccountsSettings />}
          {activeTab === "team" && <TeamSettings />}
        </div>
      </div>
    </div>
  );
}

function ProfileSettings() {
  return (
    <div>
      <h2 className="text-[15px] font-semibold mb-1">プロフィール</h2>
      <p className="mb-5 text-[12px] text-muted-foreground">
        個人情報を管理
      </p>

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

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">名前</label>
          <input
            defaultValue={currentUser.name}
            className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">メールアドレス</label>
          <input
            defaultValue="misaki.tanaka@myshop.jp"
            className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">表示名</label>
          <input
            defaultValue="美咲"
            className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
          />
        </div>
      </div>

      <div className="mt-6">
        <Button className="bg-brand hover:bg-brand/90 text-[13px]">
          保存
        </Button>
      </div>
    </div>
  );
}

function AccountsSettings() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">アカウント接続</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            メッセージを受信するアカウントを管理
          </p>
        </div>
        <Button size="sm" className="h-7 gap-1.5 text-[12px] bg-brand hover:bg-brand/90">
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
                  {channelLabels[account.channel]} · {account.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
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
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
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
                  className="h-7 text-[11px]"
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
  const [teamName, setTeamName] = useState("My Shop");
  const [editingMember, setEditingMember] = useState<string | null>(null);

  return (
    <div>
      <h2 className="text-[15px] font-semibold mb-1">チーム設定</h2>
      <p className="mb-5 text-[12px] text-muted-foreground">
        チーム名とメンバーを管理
      </p>

      {/* Team name */}
      <div className="mb-6">
        <label className="mb-1 block text-[12px] font-medium text-muted-foreground">チーム名</label>
        <div className="flex gap-2">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
          />
          <Button className="bg-brand hover:bg-brand/90 text-[12px] h-9">
            保存
          </Button>
        </div>
      </div>

      {/* Members */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">メンバー</h3>
        <Button size="sm" className="h-7 gap-1.5 text-[12px] bg-brand hover:bg-brand/90">
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
            <Avatar
              src={member.avatar}
              fallback={member.name}
              size="sm"
              className="h-8 w-8"
            />
            <div className="flex-1">
              <p className="text-[13px] font-medium">{member.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {member.id === "u1" && (
                <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                  <Shield className="h-2.5 w-2.5" />
                  管理者
                </span>
              )}
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                メンバー
              </span>
              <button
                onClick={() => setEditingMember(member.id === editingMember ? null : member.id)}
                className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
