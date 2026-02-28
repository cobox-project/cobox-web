"use client";

import { cn } from "@/lib/utils";
import { conversations, accounts, teamMembers } from "@/data/mock";
import type { Channel } from "@/data/types";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  TrendingUp,
  Clock,
  CheckCircle2,
  MessageSquare,
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

export default function ReportsPage() {
  const total = conversations.length;
  const open = conversations.filter((c) => c.status === "open").length;
  const pending = conversations.filter((c) => c.status === "pending").length;
  const resolved = conversations.filter((c) => c.status === "resolved").length;
  const unassigned = conversations.filter((c) => !c.assignee).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold">レポート</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            対応状況の概要
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <StatCard
            label="全会話"
            value={total}
            icon={MessageSquare}
            color="text-foreground"
          />
          <StatCard
            label="未対応"
            value={open}
            icon={TrendingUp}
            color="text-status-open"
          />
          <StatCard
            label="保留中"
            value={pending}
            icon={Clock}
            color="text-status-pending"
          />
          <StatCard
            label="完了"
            value={resolved}
            icon={CheckCircle2}
            color="text-status-resolved"
          />
        </div>

        {/* By channel */}
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold mb-3">アカウント別</h2>
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
                  className="grid grid-cols-5 gap-4 border-b last:border-0 px-4 py-2.5 items-center"
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
                  <span className="text-center text-[13px] font-medium text-status-open">
                    {convs.filter((c) => c.status === "open").length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-status-pending">
                    {convs.filter((c) => c.status === "pending").length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-status-resolved">
                    {convs.filter((c) => c.status === "resolved").length}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* By member */}
        <section>
          <h2 className="text-[13px] font-semibold mb-3">メンバー別</h2>
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
                  className="grid grid-cols-5 gap-4 border-b last:border-0 px-4 py-2.5 items-center"
                >
                  <div className="col-span-2 flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
                      {member.name.charAt(0)}
                    </div>
                    <span className="text-[13px] font-medium">
                      {member.name}
                    </span>
                  </div>
                  <span className="text-center text-[13px] font-medium">
                    {assigned.length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-status-open">
                    {assigned.filter((c) => c.status === "open").length}
                  </span>
                  <span className="text-center text-[13px] font-medium text-status-resolved">
                    {assigned.filter((c) => c.status === "resolved").length}
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-5 gap-4 px-4 py-2.5 items-center bg-accent/30">
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
              <span className="text-center text-[13px] font-medium text-status-open">
                {
                  conversations.filter(
                    (c) => !c.assignee && c.status === "open"
                  ).length
                }
              </span>
              <span className="text-center text-[13px] font-medium text-status-resolved">
                {
                  conversations.filter(
                    (c) => !c.assignee && c.status === "resolved"
                  ).length
                }
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
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </div>
      <span className={cn("text-[22px] font-semibold tabular-nums", color)}>
        {value}
      </span>
    </div>
  );
}
