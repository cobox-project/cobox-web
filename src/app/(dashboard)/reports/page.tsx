"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { conversations, accounts, teamMembers } from "@/data/mock";
import type { Channel } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  Clock,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

const channelIcons: Record<Channel, React.ElementType> = {
  instagram: Instagram,
  line: MessageCircle,
  email: Mail,
  facebook: Facebook,
};

const channelColors: Record<Channel, string> = {
  instagram: "oklch(0.62 0.24 330)",
  line: "oklch(0.60 0.17 145)",
  email: "oklch(0.52 0.14 250)",
  facebook: "oklch(0.50 0.18 285)",
};

const channelBgClasses: Record<Channel, string> = {
  instagram: "bg-channel-instagram",
  line: "bg-channel-line",
  email: "bg-channel-email",
  facebook: "bg-channel-facebook",
};

const channelLabels: Record<Channel, string> = {
  instagram: "Instagram",
  line: "LINE",
  email: "Email",
  facebook: "Facebook",
};

// Heatmap mock data
const days = ["月", "火", "水", "木", "金", "土", "日"];
const heatmapData: number[][] = [
  [0, 0, 0, 0, 0, 0, 1, 2, 4, 5, 3, 2, 3, 5, 6, 4, 3, 2, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 3, 4, 5, 5, 3, 2, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 2, 2, 3, 4, 4, 3, 2, 2, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 3, 2, 2, 3, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];
const maxHeat = Math.max(...heatmapData.flat());

// Stacked bar chart data (last 7 days)
const stackedData = [
  { day: "月", instagram: 3, line: 2, email: 4, facebook: 0 },
  { day: "火", instagram: 2, line: 3, email: 3, facebook: 1 },
  { day: "水", instagram: 4, line: 2, email: 5, facebook: 0 },
  { day: "木", instagram: 1, line: 4, email: 3, facebook: 1 },
  { day: "金", instagram: 5, line: 2, email: 4, facebook: 0 },
  { day: "土", instagram: 2, line: 1, email: 2, facebook: 0 },
  { day: "日", instagram: 1, line: 1, email: 1, facebook: 0 },
];

const maxStacked = Math.max(
  ...stackedData.map((d) => d.instagram + d.line + d.email + d.facebook)
);

/* ─── Tooltip component for chart hover ────── */
function BarTooltip({ d, x, y }: { d: typeof stackedData[0]; x: number; y: number }) {
  const total = d.instagram + d.line + d.email + d.facebook;
  return (
    <div
      className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
      style={{ left: x, top: y - 8, transform: "translate(-50%, -100%)" }}
    >
      <p className="font-semibold mb-1">{d.day}曜日 — 合計 {total}件</p>
      {(["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => {
        const val = d[ch];
        if (val === 0) return null;
        return (
          <div key={ch} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: channelColors[ch] }} />
            <span>{channelLabels[ch]}: {val}件</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const total = conversations.length;
  const unrepliedCount = conversations.filter((c) => {
    if (c.messages.length === 0) return true;
    const last = c.messages[c.messages.length - 1];
    return last.isInbound && !last.isInternal;
  }).length;

  const avgReplyTime = "23分";
  const prevDayTotal = total - 2;
  const changeRate = total > 0 ? Math.round(((total - prevDayTotal) / prevDayTotal) * 100) : 0;

  // Hover state for stacked bar chart
  const [hoveredBar, setHoveredBar] = useState<{ d: typeof stackedData[0]; x: number; y: number } | null>(null);
  // Hover state for heatmap
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; val: number; x: number; y: number } | null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full px-8 py-8">
        <div className="mb-6">
          <h2 className="text-[19px] font-semibold">レポート</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            対応状況の概要とパフォーマンス
          </p>
        </div>

        {/* Top metrics (3 cards) */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-white px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] text-muted-foreground">平均初動返信時間</span>
            </div>
            <p className="text-[28px] font-semibold tabular-nums">{avgReplyTime}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">問い合わせ受信から最初の返信まで</p>
          </div>
          <div className="rounded-lg border bg-white px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-[13px] text-muted-foreground">現在の未対応件数</span>
            </div>
            <p className="text-[28px] font-semibold tabular-nums text-amber-600">{unrepliedCount}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">返信が必要なスレッド数</p>
          </div>
          <div className="rounded-lg border bg-white px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <span className="text-[13px] text-muted-foreground">チャンネル別・昨対比</span>
            </div>
            <p className="text-[28px] font-semibold tabular-nums">
              {changeRate >= 0 ? "+" : ""}{changeRate}%
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">前日比（問い合わせ総数 {total}件）</p>
          </div>
        </div>

        {/* Stacked bar chart */}
        <section className="mb-8 rounded-lg border bg-white p-5">
          <h3 className="mb-4 text-[15px] font-semibold">チャンネル別問い合わせ推移</h3>
          <div className="relative flex items-end gap-2 h-48">
            {stackedData.map((d, i) => {
              const barTotal = d.instagram + d.line + d.email + d.facebook;
              const height = maxStacked > 0 ? (barTotal / maxStacked) * 180 : 0;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredBar({ d, x: rect.left + rect.width / 2, y: rect.top });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div
                    className={cn(
                      "w-full flex flex-col-reverse rounded-t overflow-hidden transition-opacity",
                      hoveredBar && hoveredBar.d.day !== d.day ? "opacity-40" : "opacity-100"
                    )}
                    style={{ height: `${height}px` }}
                  >
                    {d.email > 0 && <div className="bg-channel-email" style={{ height: `${(d.email / barTotal) * 100}%` }} />}
                    {d.line > 0 && <div className="bg-channel-line" style={{ height: `${(d.line / barTotal) * 100}%` }} />}
                    {d.instagram > 0 && <div className="bg-channel-instagram" style={{ height: `${(d.instagram / barTotal) * 100}%` }} />}
                    {d.facebook > 0 && <div className="bg-channel-facebook" style={{ height: `${(d.facebook / barTotal) * 100}%` }} />}
                  </div>
                  <span className="text-[12px] text-muted-foreground">{d.day}</span>
                </div>
              );
            })}
          </div>
          {hoveredBar && <BarTooltip d={hoveredBar.d} x={hoveredBar.x} y={hoveredBar.y} />}
          {/* Legend */}
          <div className="mt-4 flex items-center gap-4">
            {(["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => (
              <div key={ch} className="flex items-center gap-1.5">
                <div className={cn("h-3 w-3 rounded-sm", channelBgClasses[ch])} />
                <span className="text-[12px] text-muted-foreground">{channelLabels[ch]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Heatmap */}
        <section className="mb-8 rounded-lg border bg-white p-5">
          <h3 className="mb-4 text-[15px] font-semibold">応答ヒートマップ</h3>
          <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center">
              <span className="w-8 shrink-0" />
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="flex-1 text-center text-[10px] text-muted-foreground/60">
                  {i % 3 === 0 ? `${i}` : ""}
                </span>
              ))}
            </div>
            {/* Rows */}
            {days.map((day, dayIdx) => (
              <div key={day} className="flex items-center gap-0.5">
                <span className="w-8 shrink-0 text-[12px] text-muted-foreground text-right pr-2">
                  {day}
                </span>
                {heatmapData[dayIdx].map((val, hour) => {
                  const intensity = maxHeat > 0 ? val / maxHeat : 0;
                  return (
                    <div
                      key={hour}
                      className="flex-1 aspect-square rounded-sm cursor-default transition-transform hover:scale-125 hover:z-10"
                      style={{
                        backgroundColor: val === 0
                          ? "oklch(0.96 0 0)"
                          : `oklch(0.52 ${0.17 * intensity} 155 / ${0.15 + intensity * 0.85})`,
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredCell({ day, hour, val, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {hoveredCell && (
            <div
              className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
              style={{ left: hoveredCell.x, top: hoveredCell.y - 8, transform: "translate(-50%, -100%)" }}
            >
              {hoveredCell.day}曜 {hoveredCell.hour}:00 — {hoveredCell.val}件
            </div>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span>少</span>
            {[0.1, 0.3, 0.5, 0.7, 1].map((v, i) => (
              <div key={i} className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: `oklch(0.52 ${0.17 * v} 155 / ${0.15 + v * 0.85})` }} />
            ))}
            <span>多</span>
          </div>
        </section>

        {/* Staff ranking */}
        <section className="mb-8 rounded-lg border bg-white p-5">
          <h3 className="mb-4 text-[15px] font-semibold">スタッフ対応ランキング</h3>
          <div className="rounded-lg border">
            <div className="grid grid-cols-4 gap-4 border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
              <span className="col-span-1">順位</span>
              <span className="col-span-1">スタッフ名</span>
              <span className="text-center">対応完了件数</span>
              <span className="text-center">平均返信速度</span>
            </div>
            {teamMembers.map((member, i) => {
              const assigned = conversations.filter((c) => c.assignee?.id === member.id);
              const resolved = assigned.filter((c) => c.status === "resolved").length;
              const replyTimes = ["18分", "25分", "32分"];
              return (
                <div key={member.id}
                  className="grid grid-cols-4 items-center gap-4 border-b last:border-0 px-4 py-3">
                  <span className="text-[16px] font-semibold text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <Avatar src={member.avatar} fallback={member.name} size="sm" className="h-8 w-8" />
                    <span className="text-[15px] font-medium">{member.name}</span>
                  </div>
                  <span className="text-center text-[15px] font-semibold tabular-nums">
                    {resolved}
                  </span>
                  <span className="text-center text-[15px] tabular-nums">
                    {replyTimes[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Account detail table */}
        <section className="mb-8">
          <h3 className="mb-3 text-[15px] font-semibold">アカウント別詳細</h3>
          <div className="rounded-lg border bg-white">
            <div className="grid grid-cols-5 gap-4 border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
              <span className="col-span-2">アカウント</span>
              <span className="text-center">未対応</span>
              <span className="text-center">保留中</span>
              <span className="text-center">完了</span>
            </div>
            {accounts.map((account) => {
              const convs = conversations.filter((c) => c.accountId === account.id);
              const Icon = channelIcons[account.channel];
              const s = channelBgClasses[account.channel];
              return (
                <div key={account.id}
                  className="grid grid-cols-5 items-center gap-4 border-b px-4 py-3 last:border-0">
                  <div className="col-span-2 flex items-center gap-2.5">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", `${s}/10`)}>
                      <Icon className={cn("h-4 w-4", `text-channel-${account.channel}`)} />
                    </div>
                    <div>
                      <p className="text-[15px] font-medium">{account.name}</p>
                      <p className="text-[12px] text-muted-foreground">{convs.length}件</p>
                    </div>
                  </div>
                  <span className="text-center text-[15px] font-medium">
                    {convs.filter((c) => c.status === "open").length}
                  </span>
                  <span className="text-center text-[15px] font-medium text-foreground/60">
                    {convs.filter((c) => c.status === "pending").length}
                  </span>
                  <span className="text-center text-[15px] font-medium text-foreground/40">
                    {convs.filter((c) => c.status === "resolved").length}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
