"use client";

import { cn } from "@/lib/utils";
import { conversations, accounts, teamMembers } from "@/data/mock";
import type { Channel } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  TrendingUp,
  Clock,
  CheckCircle2,
  MessageSquare,
  BarChart3,
  Percent,
} from "lucide-react";

const channelIcons: Record<Channel, React.ElementType> = {
  instagram: Instagram,
  line: MessageCircle,
  email: Mail,
  facebook: Facebook,
};

const channelStyles: Record<Channel, { bg: string; text: string }> = {
  instagram: { bg: "bg-channel-instagram/10", text: "text-channel-instagram" },
  line: { bg: "bg-channel-line/10", text: "text-channel-line" },
  email: { bg: "bg-channel-email/10", text: "text-channel-email" },
  facebook: { bg: "bg-channel-facebook/10", text: "text-channel-facebook" },
};

const channelLabels: Record<Channel, string> = {
  instagram: "Instagram",
  line: "LINE",
  email: "Email",
  facebook: "Facebook",
};

export default function ReportsPage() {
  const total = conversations.length;
  const open = conversations.filter((c) => c.status === "open").length;
  const pending = conversations.filter((c) => c.status === "pending").length;
  const resolved = conversations.filter((c) => c.status === "resolved").length;
  const unassigned = conversations.filter((c) => !c.assignee).length;
  const replyRate = Math.round(
    (conversations.filter((c) => c.messages.some((m) => !m.isInbound)).length /
      total) *
      100
  );
  const completionRate = Math.round((resolved / total) * 100);

  // Hourly distribution mock
  const hourlyData = [0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 3, 2, 3, 4, 5, 3, 2, 3, 2, 1, 1, 0, 0, 0];
  const maxHourly = Math.max(...hourlyData);

  // By account
  const accountData = accounts.map((acc) => ({
    account: acc,
    count: conversations.filter((c) => c.accountId === acc.id).length,
  }));
  const maxAccountCount = Math.max(...accountData.map((a) => a.count));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold">ダッシュボード</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            対応状況の概要とパフォーマンス
          </p>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-6 gap-3">
          <StatCard
            label="全会話"
            value={String(total)}
            icon={MessageSquare}
            color="text-foreground"
          />
          <StatCard
            label="未対応"
            value={String(open)}
            icon={TrendingUp}
            color="text-foreground/70"
          />
          <StatCard
            label="保留中"
            value={String(pending)}
            icon={Clock}
            color="text-foreground/55"
          />
          <StatCard
            label="完了"
            value={String(resolved)}
            icon={CheckCircle2}
            color="text-foreground/40"
          />
          <StatCard
            label="返信率"
            value={`${replyRate}%`}
            icon={Percent}
            color="text-brand"
          />
          <StatCard
            label="完了率"
            value={`${completionRate}%`}
            icon={BarChart3}
            color="text-brand"
          />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          {/* Hourly inquiries chart */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-4 text-[13px] font-semibold">時間別問い合わせ数</h2>
            <div className="flex items-end gap-[3px] h-24">
              {hourlyData.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t bg-brand/60 transition-all"
                    style={{
                      height: maxHourly > 0 ? `${(val / maxHourly) * 80}px` : "0px",
                      minHeight: val > 0 ? "4px" : "0px",
                    }}
                  />
                  {i % 4 === 0 && (
                    <span className="text-[8px] text-muted-foreground">{i}時</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* By account chart */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-4 text-[13px] font-semibold">アカウント別問い合わせ数</h2>
            <div className="space-y-3">
              {accountData.map(({ account, count }) => {
                const Icon = channelIcons[account.channel];
                const s = channelStyles[account.channel];
                return (
                  <div key={account.id} className="flex items-center gap-3">
                    <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", s.bg)}>
                      <Icon className={cn("h-3.5 w-3.5", s.text)} />
                    </div>
                    <span className="w-20 truncate text-[11px] font-medium">{channelLabels[account.channel]}</span>
                    <div className="flex-1 h-4 bg-accent/30 rounded overflow-hidden">
                      <div
                        className={cn("h-full rounded", s.bg.replace("/10", "/40"))}
                        style={{ width: maxAccountCount > 0 ? `${(count / maxAccountCount) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-6 text-right text-[12px] font-medium tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* By channel table */}
        <section className="mb-6">
          <h2 className="mb-3 text-[13px] font-semibold">アカウント別詳細</h2>
          <div className="rounded-lg border">
            <div className="grid grid-cols-5 gap-4 border-b px-4 py-2 text-[11px] font-medium text-muted-foreground">
              <span className="col-span-2">アカウント</span>
              <span className="text-center">未対応</span>
              <span className="text-center">保留中</span>
              <span className="text-center">完了</span>
            </div>
            {accounts.map((account) => {
              const convs = conversations.filter(
                (c) => c.accountId === account.id
              );
              const Icon = channelIcons[account.channel];
              const s = channelStyles[account.channel];
              return (
                <div
                  key={account.id}
                  className="grid grid-cols-5 items-center gap-4 border-b px-4 py-2.5 last:border-0"
                >
                  <div className="col-span-2 flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md",
                        s.bg
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", s.text)} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">{account.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {convs.length}件
                      </p>
                    </div>
                  </div>
                  <span className="text-center text-[13px] font-medium text-foreground/70">
                    {convs.filter((c) => c.status === "open").length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-foreground/55">
                    {convs.filter((c) => c.status === "pending").length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-foreground/40">
                    {convs.filter((c) => c.status === "resolved").length}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* By member */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold">メンバー別</h2>
          <div className="rounded-lg border">
            <div className="grid grid-cols-5 gap-4 border-b px-4 py-2 text-[11px] font-medium text-muted-foreground">
              <span className="col-span-2">メンバー</span>
              <span className="text-center">担当中</span>
              <span className="text-center">未対応</span>
              <span className="text-center">完了</span>
            </div>
            {teamMembers.map((member) => {
              const assigned = conversations.filter(
                (c) => c.assignee?.id === member.id
              );
              return (
                <div
                  key={member.id}
                  className="grid grid-cols-5 items-center gap-4 border-b px-4 py-2.5 last:border-0"
                >
                  <div className="col-span-2 flex items-center gap-2.5">
                    <Avatar
                      src={member.avatar}
                      fallback={member.name}
                      size="sm"
                      className="h-7 w-7"
                    />
                    <span className="text-[13px] font-medium">
                      {member.name}
                    </span>
                  </div>
                  <span className="text-center text-[13px] font-medium">
                    {assigned.length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-foreground/70">
                    {assigned.filter((c) => c.status === "open").length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-foreground/40">
                    {assigned.filter((c) => c.status === "resolved").length}
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-5 items-center gap-4 px-4 py-2.5 bg-accent/30">
              <div className="col-span-2 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-[10px] text-muted-foreground">
                  ?
                </div>
                <span className="text-[13px] font-medium text-muted-foreground">
                  未アサイン
                </span>
              </div>
              <span className="text-center text-[13px] font-medium">
                {unassigned}
              </span>
              <span className="text-center text-[13px] font-medium text-foreground/70">
                {conversations.filter((c) => !c.assignee && c.status === "open").length}
              </span>
              <span className="text-center text-[13px] font-medium text-foreground/40">
                {conversations.filter((c) => !c.assignee && c.status === "resolved").length}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </div>
      <span className={cn("text-[22px] font-semibold tabular-nums", color)}>
        {value}
      </span>
    </div>
  );
}
