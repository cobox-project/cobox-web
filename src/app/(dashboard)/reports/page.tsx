"use client";

import { useState, useMemo } from "react";
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
  Inbox,
  CheckCircle2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
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

// Helper: format date as YYYY/M/D
function formatDateFull(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// Helper: format date as M/D
function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Helper: get Monday of the week containing the given date
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Generate weekly stacked bar data for a given week start (Monday)
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
    return {
      label,
      date: formatDate(date),
      fullDate: date,
      instagram,
      line,
      email,
      facebook,
      resolved,
    };
  });
}

// Generate heatmap data for a given week
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

/* ─── Week Navigation component ────── */
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

/* ─── Tooltip component for chart hover ────── */
function BarTooltip({ d, x, y }: { d: ReturnType<typeof generateWeekData>[0]; x: number; y: number }) {
  const total = d.instagram + d.line + d.email + d.facebook;
  return (
    <div
      className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
      style={{ left: x, top: y - 8, transform: "translate(-50%, -100%)" }}
    >
      <p className="font-semibold mb-1">{d.date}（{d.label}） — 合計 {total}件 / 解決 {d.resolved}件</p>
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
  const assignedCount = conversations.filter((c) => c.assignee).length;
  const resolvedCount = conversations.filter((c) => c.status === "resolved").length;
  const avgReplyTime = "23分";

  // Previous period comparison (mock)
  const prevTotal = total - 2;
  const prevAssigned = assignedCount - 1;
  const prevResolved = resolvedCount + 1;

  // Chart week navigation
  const [chartWeekOffset, setChartWeekOffset] = useState(0);
  const chartMonday = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + chartWeekOffset * 7);
    return monday;
  }, [chartWeekOffset]);
  const chartWeekEnd = useMemo(() => {
    const sun = new Date(chartMonday);
    sun.setDate(chartMonday.getDate() + 6);
    return sun;
  }, [chartMonday]);

  // Heatmap week navigation
  const [heatmapWeekOffset, setHeatmapWeekOffset] = useState(0);
  const heatmapMonday = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + heatmapWeekOffset * 7);
    return monday;
  }, [heatmapWeekOffset]);
  const heatmapWeekEnd = useMemo(() => {
    const sun = new Date(heatmapMonday);
    sun.setDate(heatmapMonday.getDate() + 6);
    return sun;
  }, [heatmapMonday]);

  const stackedData = useMemo(() => generateWeekData(chartMonday), [chartMonday]);
  const maxStacked = Math.max(...stackedData.map((d) => d.instagram + d.line + d.email + d.facebook));
  const maxResolved = Math.max(...stackedData.map((d) => d.resolved));

  const heatmapData = useMemo(() => generateHeatmapData(heatmapMonday), [heatmapMonday]);
  const maxHeat = Math.max(...heatmapData.flat());

  // Hover state for stacked bar chart
  const [hoveredBar, setHoveredBar] = useState<{ d: typeof stackedData[0]; x: number; y: number } | null>(null);
  // Hover state for heatmap
  const [hoveredCell, setHoveredCell] = useState<{ day: string; date: string; hour: number; val: number; x: number; y: number } | null>(null);

  const calcChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? "+100%" : "—";
    const pct = Math.round(((current - prev) / prev) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  // Heatmap date labels
  const heatmapDates = useMemo(() => {
    return dayLabels.map((_, i) => {
      const date = new Date(heatmapMonday);
      date.setDate(heatmapMonday.getDate() + i);
      return formatDate(date);
    });
  }, [heatmapMonday]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full px-8 py-8">
        <div className="mb-6">
          <h2 className="text-[19px] font-semibold">レポート</h2>
        </div>

        {/* Top metrics (4 cards) */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-white px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] text-muted-foreground">本日の新着</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-[28px] font-semibold tabular-nums">{total}</p>
              <span className={cn("text-[13px] font-medium", total >= prevTotal ? "text-brand" : "text-destructive")}>
                {calcChange(total, prevTotal)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">前日比 {prevTotal}件</p>
          </div>
          <div className="rounded-lg border bg-white px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-amber-500" />
              <span className="text-[13px] text-muted-foreground">アサイン中</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-[28px] font-semibold tabular-nums text-amber-600">{assignedCount}</p>
              <span className={cn("text-[13px] font-medium", assignedCount >= prevAssigned ? "text-amber-500" : "text-brand")}>
                {calcChange(assignedCount, prevAssigned)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">前日比 {prevAssigned}件</p>
          </div>
          <div className="rounded-lg border bg-white px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-brand" />
              <span className="text-[13px] text-muted-foreground">本日解決済みにした数</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-[28px] font-semibold tabular-nums text-brand">{resolvedCount}</p>
              <span className={cn("text-[13px] font-medium", resolvedCount >= prevResolved ? "text-brand" : "text-destructive")}>
                {calcChange(resolvedCount, prevResolved)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">前日比 {prevResolved}件</p>
          </div>
          <div className="rounded-lg border bg-white px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] text-muted-foreground">平均初動返信</span>
            </div>
            <p className="text-[28px] font-semibold tabular-nums">{avgReplyTime}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">問い合わせ受信から最初の返信まで</p>
          </div>
        </div>

        {/* Row 1: Chart + Heatmap (2-column) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Stacked bar chart with resolved line overlay */}
          <section className="rounded-lg border bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">チャンネル別推移</h3>
              <WeekNav weekOffset={chartWeekOffset} setWeekOffset={setChartWeekOffset} currentMonday={chartMonday} weekEnd={chartWeekEnd} />
            </div>
            <div className="relative h-52">
              {/* SVG line graph overlay for resolved count */}
              <svg className="absolute inset-0 w-full h-[180px] pointer-events-none z-10" viewBox="0 0 700 180" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="oklch(0.52 0.17 155)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={stackedData.map((d, i) => {
                    const x = (i * 100) + 50;
                    const y = maxResolved > 0 ? 180 - (d.resolved / maxResolved) * 160 : 180;
                    return `${x},${y}`;
                  }).join(" ")}
                />
                {stackedData.map((d, i) => {
                  const x = (i * 100) + 50;
                  const y = maxResolved > 0 ? 180 - (d.resolved / maxResolved) * 160 : 180;
                  return (
                    <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke="oklch(0.52 0.17 155)" strokeWidth="2" />
                  );
                })}
              </svg>
              {/* Bars */}
              <div className="relative flex items-end gap-2 h-[180px]">
                {stackedData.map((d, i) => {
                  const barTotal = d.instagram + d.line + d.email + d.facebook;
                  const height = maxStacked > 0 ? (barTotal / maxStacked) * 170 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredBar({ d, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <div
                        className={cn(
                          "w-full flex flex-col-reverse rounded-t overflow-hidden transition-opacity",
                          hoveredBar && hoveredBar.d.date !== d.date ? "opacity-40" : "opacity-100"
                        )}
                        style={{ height: `${height}px` }}
                      >
                        {d.email > 0 && <div className="bg-channel-email" style={{ height: `${(d.email / barTotal) * 100}%` }} />}
                        {d.line > 0 && <div className="bg-channel-line" style={{ height: `${(d.line / barTotal) * 100}%` }} />}
                        {d.instagram > 0 && <div className="bg-channel-instagram" style={{ height: `${(d.instagram / barTotal) * 100}%` }} />}
                        {d.facebook > 0 && <div className="bg-channel-facebook" style={{ height: `${(d.facebook / barTotal) * 100}%` }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Date + day labels below bars */}
              <div className="flex gap-2 mt-1">
                {stackedData.map((d, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="text-[11px] text-muted-foreground leading-tight">{d.date}</div>
                    <div className="text-[10px] text-muted-foreground/60">{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {hoveredBar && <BarTooltip d={hoveredBar.d} x={hoveredBar.x} y={hoveredBar.y} />}
            {/* Legend */}
            <div className="mt-3 flex items-center gap-4">
              {(["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => (
                <div key={ch} className="flex items-center gap-1.5">
                  <div className={cn("h-3 w-3 rounded-sm", channelBgClasses[ch])} />
                  <span className="text-[12px] text-muted-foreground">{channelLabels[ch]}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-3 rounded-full bg-brand" />
                <span className="text-[12px] text-muted-foreground">解決済み</span>
              </div>
            </div>
          </section>

          {/* Heatmap */}
          <section className="rounded-lg border bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">応答ヒートマップ</h3>
              <WeekNav weekOffset={heatmapWeekOffset} setWeekOffset={setHeatmapWeekOffset} currentMonday={heatmapMonday} weekEnd={heatmapWeekEnd} />
            </div>
            <div className="space-y-1">
              {/* Hour header */}
              <div className="flex items-center">
                <span className="w-14 shrink-0" />
                {Array.from({ length: 24 }, (_, i) => (
                  <span key={i} className="flex-1 text-center text-[10px] text-muted-foreground/60">
                    {i % 3 === 0 ? `${i}` : ""}
                  </span>
                ))}
              </div>
              {/* Rows */}
              {dayLabels.map((day, dayIdx) => (
                <div key={day} className="flex items-center gap-0.5">
                  <span className="w-14 shrink-0 text-[12px] text-muted-foreground text-right pr-2">
                    <span>{heatmapDates[dayIdx]}</span>
                    <span className="ml-0.5 text-muted-foreground/50">{day}</span>
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
                          setHoveredCell({ day, date: heatmapDates[dayIdx], hour, val, x: rect.left + rect.width / 2, y: rect.top });
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

        {/* Row 2: Ranking + Account detail (2-column) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Staff ranking */}
          <section className="rounded-lg border bg-white p-5">
            <h3 className="mb-4 text-[15px] font-semibold">スタッフ対応ランキング</h3>
            <div className="rounded-lg border">
              <div className="grid grid-cols-4 gap-4 border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
                <span className="col-span-1">順位</span>
                <span className="col-span-1">スタッフ名</span>
                <span className="text-center">対応解決件数</span>
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
          <section className="rounded-lg border bg-white p-5">
            <h3 className="mb-4 text-[15px] font-semibold">アカウント別</h3>
            <div className="rounded-lg border">
              <div className="grid grid-cols-5 gap-4 border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
                <span className="col-span-2">アカウント</span>
                <span className="text-center">未対応</span>
                <span className="text-center">対応中</span>
                <span className="text-center">解決済み</span>
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
    </div>
  );
}
