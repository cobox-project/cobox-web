"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { accounts, teamMembers, memberPermissions as initialPermissions } from "@/data/mock";
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
  Plus,
  Trash2,
  Shield,
  CreditCard,
  Eye,
  MessageSquare,
} from "lucide-react";

const tabs = [
  { id: "accounts", label: "アカウント接続", icon: Link2 },
  { id: "team", label: "チーム管理", icon: Users },
  { id: "billing", label: "支払い", icon: CreditCard },
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
      {/* Layer 2: Settings nav (220px) */}
      <div className="w-[220px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="mb-4 px-2.5 text-[15px] font-semibold">管理</h1>

        <nav className="space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[15px] font-medium transition-colors cursor-pointer",
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

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-6">
          {activeTab === "accounts" && <AccountsSettings />}
          {activeTab === "team" && <TeamSettings />}
          {activeTab === "billing" && <BillingSettings />}
        </div>
      </div>
    </div>
  );
}

function AccountsSettings() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold">アカウント接続</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            メッセージを受信するアカウントを管理
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-[13px] bg-brand hover:bg-brand/90">
          <Plus className="h-3.5 w-3.5" />
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
              className="flex items-center gap-3 rounded-lg border px-4 py-3.5"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  s.bg
                )}
              >
                <Icon className={cn("h-5 w-5", s.text)} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-medium">{account.name}</p>
                <p className="text-[13px] text-muted-foreground">
                  {channelLabels[account.channel]} · {account.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-medium text-brand">
                  接続中
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">
          追加可能
        </p>
        <div className="space-y-1.5">
          {(["facebook"] as Channel[]).map((channel) => {
            const Icon = channelIcons[channel];
            const s = channelStyles[channel];
            return (
              <div
                key={channel}
                className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3.5"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    s.bg
                  )}
                >
                  <Icon className={cn("h-5 w-5", s.text)} />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-medium">
                    {channelLabels[channel]}
                  </p>
                  <p className="text-[13px] text-muted-foreground">未接続</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[13px]"
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
  const [permissions, setPermissions] = useState(initialPermissions);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handlePermissionChange = (
    memberId: string,
    accountId: string,
    field: "canView" | "canReply",
    value: boolean
  ) => {
    setPermissions((prev) =>
      prev.map((mp) => {
        if (mp.memberId !== memberId) return mp;
        return {
          ...mp,
          permissions: mp.permissions.map((p) => {
            if (p.accountId !== accountId) return p;
            const updated = { ...p, [field]: value };
            if (field === "canView" && !value) {
              updated.canReply = false;
            }
            return updated;
          }),
        };
      })
    );
  };

  return (
    <div>
      <h2 className="text-[17px] font-semibold mb-1">チーム管理</h2>
      <p className="mb-5 text-[13px] text-muted-foreground">
        チームメンバーとアカウント権限を管理
      </p>

      {/* Team name */}
      <div className="mb-8">
        <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">チーム名</label>
        <div className="flex gap-2">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40"
          />
          <Button className="bg-brand hover:bg-brand/90 text-[13px] h-10">
            保存
          </Button>
        </div>
      </div>

      {/* Members with permissions */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">メンバー</h3>
        <Button size="sm" className="h-8 gap-1.5 text-[13px] bg-brand hover:bg-brand/90">
          <Plus className="h-3.5 w-3.5" />
          招待
        </Button>
      </div>

      <div className="rounded-lg border">
        {teamMembers.map((member, i) => {
          const memberPerms = permissions.find((p) => p.memberId === member.id);
          const isExpanded = expandedMember === member.id;

          return (
            <div
              key={member.id}
              className={cn(i < teamMembers.length - 1 && "border-b")}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Avatar
                  src={member.avatar}
                  fallback={member.name}
                  size="sm"
                  className="h-9 w-9"
                />
                <div className="flex-1">
                  <p className="text-[15px] font-medium">{member.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === "admin" && (
                    <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-medium text-brand">
                      <Shield className="h-3 w-3" />
                      管理者
                    </span>
                  )}
                  <button
                    onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                      isExpanded
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    権限設定
                  </button>
                </div>
              </div>

              {/* Permission details */}
              {isExpanded && memberPerms && (
                <div className="border-t bg-accent/20 px-4 py-4">
                  <p className="text-[13px] font-medium text-muted-foreground mb-3">
                    アカウント別権限
                  </p>
                  <div className="space-y-2">
                    {accounts.map((account) => {
                      const perm = memberPerms.permissions.find(
                        (p) => p.accountId === account.id
                      );
                      if (!perm) return null;
                      const Icon = channelIcons[account.channel];
                      const s = channelStyles[account.channel];

                      return (
                        <div
                          key={account.id}
                          className="flex items-center gap-3 rounded-lg bg-background border px-4 py-3"
                        >
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", s.bg)}>
                            <Icon className={cn("h-4 w-4", s.text)} />
                          </div>
                          <span className="flex-1 text-[14px] font-medium truncate">
                            {account.name}
                          </span>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={perm.canView}
                                onChange={(e) =>
                                  handlePermissionChange(member.id, account.id, "canView", e.target.checked)
                                }
                                className="h-4 w-4 rounded accent-brand"
                              />
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-[13px] text-muted-foreground">閲覧</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={perm.canReply}
                                disabled={!perm.canView}
                                onChange={(e) =>
                                  handlePermissionChange(member.id, account.id, "canReply", e.target.checked)
                                }
                                className="h-4 w-4 rounded accent-brand disabled:opacity-30"
                              />
                              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-[13px] text-muted-foreground">返信</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BillingSettings() {
  return (
    <div>
      <h2 className="text-[17px] font-semibold mb-1">支払い</h2>
      <p className="mb-5 text-[13px] text-muted-foreground">
        プランと請求情報を管理
      </p>

      {/* Current plan */}
      <section className="mb-8">
        <h3 className="text-[15px] font-medium mb-3">現在のプラン</h3>
        <div className="rounded-lg border px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[17px] font-semibold">スタンダードプラン</p>
              <p className="text-[13px] text-muted-foreground">月額 ¥3,980（税別）</p>
            </div>
            <Button variant="outline" size="sm" className="h-9 text-[13px] px-4">
              プラン変更
            </Button>
          </div>
          <div className="flex gap-6 text-[13px]">
            <div>
              <span className="text-muted-foreground">メンバー数: </span>
              <span className="font-medium">{teamMembers.length}人</span>
            </div>
            <div>
              <span className="text-muted-foreground">追加メンバー: </span>
              <span className="font-medium">¥500/人</span>
            </div>
            <div>
              <span className="text-muted-foreground">次回請求日: </span>
              <span className="font-medium">2026-04-01</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment method */}
      <section className="mb-8">
        <h3 className="text-[15px] font-medium mb-3">お支払い方法</h3>
        <div className="rounded-lg border px-5 py-4 flex items-center gap-4">
          <div className="flex h-10 w-16 items-center justify-center rounded-md bg-accent text-[14px] font-bold text-muted-foreground">
            VISA
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-medium">**** **** **** 4242</p>
            <p className="text-[13px] text-muted-foreground">有効期限: 12/2027</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-[13px]">
            変更
          </Button>
        </div>
      </section>

      {/* Billing history */}
      <section>
        <h3 className="text-[15px] font-medium mb-3">請求履歴</h3>
        <div className="rounded-lg border">
          <div className="grid grid-cols-4 gap-4 border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
            <span>日付</span>
            <span>内容</span>
            <span className="text-right">金額</span>
            <span className="text-right">ステータス</span>
          </div>
          {[
            { date: "2026-03-01", desc: "スタンダードプラン", amount: "¥4,378", status: "支払済" },
            { date: "2026-02-01", desc: "スタンダードプラン", amount: "¥4,378", status: "支払済" },
            { date: "2026-01-01", desc: "スタンダードプラン + メンバー追加×1", amount: "¥4,928", status: "支払済" },
          ].map((item, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 border-b last:border-0 px-4 py-3">
              <span className="text-[14px]">{item.date}</span>
              <span className="text-[14px]">{item.desc}</span>
              <span className="text-[14px] text-right font-medium">{item.amount}</span>
              <span className="text-right">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[12px] font-medium text-brand">
                  {item.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
