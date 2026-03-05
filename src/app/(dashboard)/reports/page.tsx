"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { conversations, accounts, teamMembers } from "@/data/mock";
import type { Channel } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,

  Inbox,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Users,
  LayoutDashboard,
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

const dayLabels = ["月", "火", "水", "木", "金", "土", "日"];

function formatDateFull(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function generateWeekData(weekStart: Date) {
  return dayLabels.map((label, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const seed = date.getDate() + date.getMonth() * 31;
    const instagram = ((seed * 3 + 7) % 5) + 1;
    const line = ((seed * 5 + 3) % 4) + 1;
    const email = ((seed * 7 + 2) % 6) + 1;
    const facebook = (seed * 11) % 3;
    const resolved = Math.max(0, Math.floor((instagram + line + email + facebook) * 0.4 + ((seed * 13) % 3) - 1));
    return { label, date: formatDate(date), fullDate: date, instagram, line, email, facebook, resolved };
  });
}

function generateHeatmapData(weekStart: Date): number[][] {
  return dayLabels.map((_, dayIdx) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayIdx);
    const baseSeed = date.getDate() + date.getMonth() * 31;
    return Array.from({ length: 24 }, (_, hour) => {
      if (hour < 6) return 0;
      if (hour > 20) return 0;
      const seed = baseSeed + hour * 7;
      const peak = hour >= 9 && hour <= 17 ? 3 : 0;
      return Math.max(0, ((seed * 3 + hour * 5) % 7) - 1 + peak);
    });
  });
}

function WeekNav({ weekOffset, setWeekOffset, currentMonday, weekEnd }: {
  weekOffset: number; setWeekOffset: (fn: (p: number) => number) => void;
  currentMonday: Date; weekEnd: Date;
}) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setWeekOffset((p) => p - 1)} className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-[13px] font-medium text-muted-foreground min-w-[160px] text-center">
        {formatDateFull(currentMonday)} - {formatDate(weekEnd)}
      </span>
      <button onClick={() => setWeekOffset((p) => Math.min(p + 1, 0))} disabled={weekOffset >= 0}
        className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function BarTooltip({ d, x, y }: { d: ReturnType<typeof generateWeekData>[0]; x: number; y: number }) {
  const total = d.instagram + d.line + d.email + d.facebook;
  return (
    <div
      className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
      style={{ left: x, top: y - 8, transform: "translate(-50%, -100%)" }}
    >
      <p className="font-semibold mb-1">{d.date}（{d.label}） — 合計 {total}件 / 完了 {d.resolved}件</p>
      {(["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => {
        const val = d[ch as keyof typeof d] as number;
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

// Pie chart component with hover tooltips
function ChannelPieChart() {
  const [hoveredSlice, setHoveredSlice] = useState<{ channel: Channel; count: number; x: number; y: number } | null>(null);
  const channelCounts = (["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => ({
    channel: ch,
    count: conversations.filter((c) => c.channel === ch).length,
  }));
  const total = channelCounts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const slices = channelCounts.filter((c) => c.count > 0).map((c) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += c.count;
    const endAngle = (cumulative / total) * 360;
    return { ...c, startAngle, endAngle };
  });

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <div className="flex items-center gap-4">
      <svg width="72" height="72" viewBox="0 0 72 72" className="cursor-default">
        {slices.map((s) => {
          const start = polarToCartesian(36, 36, 30, s.startAngle);
          const end = polarToCartesian(36, 36, 30, s.endAngle);
          const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0;
          const d = `M36,36 L${start.x},${start.y} A30,30 0 ${largeArc},1 ${end.x},${end.y} Z`;
          return <path key={s.channel} d={d} fill={channelColors[s.channel]}
            className="transition-opacity hover:opacity-80"
            onMouseEnter={(e) => {
              const rect = (e.target as SVGPathElement).closest("svg")!.getBoundingClientRect();
              setHoveredSlice({ channel: s.channel, count: s.count, x: rect.left + rect.width / 2, y: rect.top });
            }}
            onMouseLeave={() => setHoveredSlice(null)}
          />;
        })}
      </svg>
      <div className="space-y-1">
        {slices.map((s) => (
          <div key={s.channel} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: channelColors[s.channel] }} />
            <span className="text-[12px] text-muted-foreground">{channelLabels[s.channel]} {s.count}</span>
          </div>
        ))}
      </div>
      {hoveredSlice && (
        <div className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
          style={{ left: hoveredSlice.x, top: hoveredSlice.y - 8, transform: "translate(-50%, -100%)" }}>
          {channelLabels[hoveredSlice.channel]}: {hoveredSlice.count}件 ({Math.round((hoveredSlice.count / total) * 100)}%)
        </div>
      )}
    </div>
  );
}

// Sub-navigation tabs
type ReportTab = "summary" | "channel" | "staff";

const reportTabs = [
  { id: "summary" as ReportTab, label: "サマリー", icon: LayoutDashboard },
  { id: "channel" as ReportTab, label: "チャネル", icon: BarChart3 },
  { id: "staff" as ReportTab, label: "メンバー", icon: Users },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const [weekOffset, setWeekOffset] = useState(0);

  const currentMonday = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const sun = new Date(currentMonday);
    sun.setDate(currentMonday.getDate() + 6);
    return sun;
  }, [currentMonday]);

  return (
    <div className="flex h-full">
      {/* Left sub-navigation */}
      <div className="w-[220px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="mb-4 px-2.5 text-[15px] font-semibold">レポート</h1>
        <nav className="space-y-0.5">
          {reportTabs.map((tab) => {
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-8">
          {activeTab === "summary" && (
            <SummaryReport weekOffset={weekOffset} setWeekOffset={setWeekOffset} currentMonday={currentMonday} weekEnd={weekEnd} />
          )}
          {activeTab === "channel" && <ChannelReport />}
          {activeTab === "staff" && (
            <MemberReport weekOffset={weekOffset} setWeekOffset={setWeekOffset} currentMonday={currentMonday} weekEnd={weekEnd} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Summary Report ────── */

function SummaryReport({ weekOffset, setWeekOffset, currentMonday, weekEnd }: {
  weekOffset: number; setWeekOffset: (fn: (p: number) => number) => void;
  currentMonday: Date; weekEnd: Date;
}) {
  const total = conversations.length;
  const resolvedCount = conversations.filter((c) => c.status === "completed").length;

  const stackedData = useMemo(() => generateWeekData(currentMonday), [currentMonday]);
  const maxStacked = Math.max(...stackedData.map((d) => d.instagram + d.line + d.email + d.facebook));
  const maxResolved = Math.max(...stackedData.map((d) => d.resolved));

  const heatmapData = useMemo(() => generateHeatmapData(currentMonday), [currentMonday]);
  const maxHeat = Math.max(...heatmapData.flat());

  const [hoveredBar, setHoveredBar] = useState<{ d: typeof stackedData[0]; x: number; y: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ day: string; date: string; hour: number; val: number; x: number; y: number } | null>(null);

  const heatmapDates = useMemo(() => {
    return dayLabels.map((_, i) => {
      const date = new Date(currentMonday);
      date.setDate(currentMonday.getDate() + i);
      return formatDate(date);
    });
  }, [currentMonday]);

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-[19px] font-semibold">サマリー</h2>
        <WeekNav weekOffset={weekOffset} setWeekOffset={setWeekOffset} currentMonday={currentMonday} weekEnd={weekEnd} />
      </div>

      {/* Top metrics - 3 cards */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white px-5 py-5">
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">新着</span>
          </div>
          <p className="text-[28px] font-semibold tabular-nums">{total}</p>
        </div>
        <div className="rounded-lg border bg-white px-5 py-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-brand" />
            <span className="text-[13px] text-muted-foreground">完了数</span>
          </div>
          <p className="text-[28px] font-semibold tabular-nums text-brand">{resolvedCount}</p>
        </div>
        <div className="rounded-lg border bg-white px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">チャネル比率</span>
          </div>
          <ChannelPieChart />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        {/* Stacked bar chart */}
        <section className="rounded-lg border bg-white p-5">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold">チャンネル別推移</h3>
          </div>
          <div className="relative h-72">
            <svg className="absolute inset-0 w-full h-[260px] pointer-events-none z-10" viewBox="0 0 700 260" preserveAspectRatio="none">
              <polyline fill="none" stroke="oklch(0.52 0.17 155)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                points={stackedData.map((d, i) => {
                  const x = (i * 100) + 50;
                  const y = maxResolved > 0 ? 260 - (d.resolved / maxResolved) * 240 : 260;
                  return `${x},${y}`;
                }).join(" ")} />
              {stackedData.map((d, i) => {
                const x = (i * 100) + 50;
                const y = maxResolved > 0 ? 260 - (d.resolved / maxResolved) * 240 : 260;
                return <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke="oklch(0.52 0.17 155)" strokeWidth="2" />;
              })}
            </svg>
            <div className="relative flex items-end justify-around h-[260px] px-4">
              {stackedData.map((d, i) => {
                const barTotal = d.instagram + d.line + d.email + d.facebook;
                const height = maxStacked > 0 ? (barTotal / maxStacked) * 250 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center max-w-[36px]"
                    onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHoveredBar({ d, x: rect.left + rect.width / 2, y: rect.top }); }}
                    onMouseLeave={() => setHoveredBar(null)}>
                    <div className={cn("w-full flex flex-col-reverse rounded-t overflow-hidden transition-opacity",
                      hoveredBar && hoveredBar.d.date !== d.date ? "opacity-40" : "opacity-100"
                    )} style={{ height: `${height}px` }}>
                      {d.email > 0 && <div className="bg-channel-email" style={{ height: `${(d.email / barTotal) * 100}%` }} />}
                      {d.line > 0 && <div className="bg-channel-line" style={{ height: `${(d.line / barTotal) * 100}%` }} />}
                      {d.instagram > 0 && <div className="bg-channel-instagram" style={{ height: `${(d.instagram / barTotal) * 100}%` }} />}
                      {d.facebook > 0 && <div className="bg-channel-facebook" style={{ height: `${(d.facebook / barTotal) * 100}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-around mt-1 px-4">
              {stackedData.map((d, i) => (
                <div key={i} className="flex-1 max-w-[36px] text-center">
                  <div className="text-[11px] text-muted-foreground leading-tight">{d.date}</div>
                  <div className="text-[10px] text-muted-foreground/60">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          {hoveredBar && <BarTooltip d={hoveredBar.d} x={hoveredBar.x} y={hoveredBar.y} />}
          <div className="mt-3 flex items-center gap-4">
            {(["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => (
              <div key={ch} className="flex items-center gap-1.5">
                <div className={cn("h-3 w-3 rounded-sm", channelBgClasses[ch])} />
                <span className="text-[12px] text-muted-foreground">{channelLabels[ch]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-3 rounded-full bg-brand" />
              <span className="text-[12px] text-muted-foreground">完了</span>
            </div>
          </div>
        </section>

        {/* Heatmap - axes swapped: columns=days, rows=hours */}
        <section className="rounded-lg border bg-white p-5">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold">新着時間ヒートマップ</h3>
          </div>
          <div className="space-y-0.5">
            {/* Day labels header */}
            <div className="flex items-center">
              <span className="w-10 shrink-0" />
              {dayLabels.map((day, dayIdx) => (
                <span key={dayIdx} className="flex-1 text-center text-[11px] text-muted-foreground">
                  <span>{heatmapDates[dayIdx]}</span>
                  <span className="ml-0.5 text-muted-foreground/50">{day}</span>
                </span>
              ))}
            </div>
            {/* Hour rows */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="flex items-center gap-0.5">
                <span className="w-10 shrink-0 text-[11px] text-muted-foreground text-right pr-1.5">
                  {hour}:00
                </span>
                {dayLabels.map((day, dayIdx) => {
                  const val = heatmapData[dayIdx][hour];
                  const intensity = maxHeat > 0 ? val / maxHeat : 0;
                  return (
                    <div key={dayIdx} className="flex-1 h-[9px] rounded-sm cursor-default transition-transform hover:scale-110 hover:z-10"
                      style={{ backgroundColor: val === 0 ? "oklch(0.96 0 0)" : `oklch(0.52 ${0.17 * intensity} 155 / ${0.15 + intensity * 0.85})` }}
                      onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHoveredCell({ day, date: heatmapDates[dayIdx], hour, val, x: rect.left + rect.width / 2, y: rect.top }); }}
                      onMouseLeave={() => setHoveredCell(null)} />
                  );
                })}
              </div>
            ))}
          </div>
          {hoveredCell && (
            <div className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
              style={{ left: hoveredCell.x, top: hoveredCell.y - 8, transform: "translate(-50%, -100%)" }}>
              {hoveredCell.date}（{hoveredCell.day}） {hoveredCell.hour}:00 — {hoveredCell.val}件
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
      </div>
    </>
  );
}

/* ─── Channel Report ─────────────────────── */

function ChannelReport() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-[19px] font-semibold">チャネル</h2>
      </div>

      <div className="space-y-4">
        {accounts.map((account) => {
          const convs = conversations.filter((c) => c.accountId === account.id);
          const Icon = channelIcons[account.channel];
          return (
            <section key={account.id} className="rounded-lg border bg-white p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", `bg-channel-${account.channel}/10`)}>
                  <Icon className={cn("h-5 w-5", `text-channel-${account.channel}`)} />
                </div>
                <div>
                  <p className="text-[16px] font-semibold">{account.name}</p>
                  <p className="text-[13px] text-muted-foreground">{channelLabels[account.channel]} · {account.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-md bg-accent/30 px-4 py-3">
                  <p className="text-[12px] text-muted-foreground">合計</p>
                  <p className="text-[20px] font-semibold tabular-nums">{convs.length}</p>
                </div>
                <div className="rounded-md bg-accent/30 px-4 py-3">
                  <p className="text-[12px] text-muted-foreground">新着</p>
                  <p className="text-[20px] font-semibold tabular-nums">{convs.filter((c) => c.status === "open" && c.assignees.length === 0).length}</p>
                </div>
                <div className="rounded-md bg-accent/30 px-4 py-3">
                  <p className="text-[12px] text-muted-foreground">対応中</p>
                  <p className="text-[20px] font-semibold tabular-nums">{convs.filter((c) => c.status === "open" && c.assignees.length > 0).length}</p>
                </div>
                <div className="rounded-md bg-accent/30 px-4 py-3">
                  <p className="text-[12px] text-muted-foreground">完了</p>
                  <p className="text-[20px] font-semibold tabular-nums text-brand">{convs.filter((c) => c.status === "completed").length}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ─── Member Report (renamed from Staff) ───── */

function MemberReport({ weekOffset, setWeekOffset, currentMonday, weekEnd }: {
  weekOffset: number; setWeekOffset: (fn: (p: number) => number) => void;
  currentMonday: Date; weekEnd: Date;
}) {
  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-[19px] font-semibold">メンバー</h2>
        <WeekNav weekOffset={weekOffset} setWeekOffset={setWeekOffset} currentMonday={currentMonday} weekEnd={weekEnd} />
      </div>

      <section className="rounded-lg border bg-white">
        <div className="grid grid-cols-3 gap-4 border-b px-5 py-2.5 text-[13px] font-medium text-muted-foreground">
          <span>メンバー</span>
          <span className="text-center">担当件数</span>
          <span className="text-center">完了件数</span>
        </div>
        {teamMembers.map((member, i) => {
          const assigned = conversations.filter((c) => c.assignees.some((a) => a.id === member.id));
          const completed = assigned.filter((c) => c.status === "completed").length;
          return (
            <div key={member.id} className="grid grid-cols-3 items-center gap-4 border-b last:border-0 px-5 py-3">
              <div className="flex items-center gap-2.5">
                <Avatar src={member.avatar} fallback={member.name} size="sm" className="h-8 w-8" />
                <span className="text-[15px] font-medium">{member.name}</span>
              </div>
              <span className="text-center text-[15px] font-medium tabular-nums">{assigned.length}</span>
              <span className="text-center text-[15px] font-semibold tabular-nums text-brand">{completed}</span>
            </div>
          );
        })}
      </section>
    </>
  );
}
